local M = {}
local state = { pending = {}, events = {}, serial = 0, remainder = '', generation = 0 }
local namespace = vim.api.nvim_create_namespace('oax-agent')
local function utf16(line, byte)
  local prefix = line:sub(1, byte)
  local count = 0
  for i = 1, #prefix do
    local byte = prefix:byte(i)
    if byte < 128 or byte >= 192 then count = count + (byte >= 240 and 2 or 1) end
  end
  return count
end
local function point(buf, row, col)
  local line = vim.api.nvim_buf_get_lines(buf, row, row + 1, false)[1] or ''
  return {line = row, column = utf16(line, col)}
end
function M.capture()
  local buf = vim.api.nvim_get_current_buf()
  local file = vim.fs.normalize(vim.api.nvim_buf_get_name(buf))
  local root = vim.fs.normalize(state.root):gsub('/$', '')
  assert(file:sub(1, #root + 1):lower() == (root .. '/'):lower(), 'File outside configured workspace')
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
  local text = table.concat(lines, '\n') .. (vim.bo[buf].endofline and '\n' or '')
  local cursor = vim.api.nvim_win_get_cursor(0)
  local start = point(buf, cursor[1] - 1, cursor[2])
  local selection = {start = start, ['end'] = start}
  local mode = vim.fn.mode()
  if mode == 'v' or mode == 'V' then
    local anchor = vim.fn.getpos('v')
    local first, last = {anchor[2] - 1, anchor[3] - 1}, {cursor[1] - 1, cursor[2]}
    if first[1] > last[1] or (first[1] == last[1] and first[2] > last[2]) then first, last = last, first end
    if mode == 'V' then first[2] = 0; last[2] = #(lines[last[1] + 1] or '')
    else
      local tail = (lines[last[1] + 1] or ''):sub(last[2] + 1)
      local char = vim.fn.strcharpart(tail, 0, 1)
      last[2] = last[2] + #char
    end
    selection = {start = point(buf, first[1], first[2]), ['end'] = point(buf, last[1], last[2])}
  end
  local open = {}
  for _, tab in ipairs(vim.api.nvim_list_tabpages()) do
    for _, win in ipairs(vim.api.nvim_tabpage_list_wins(tab)) do
      local name = vim.fs.normalize(vim.api.nvim_buf_get_name(vim.api.nvim_win_get_buf(win)))
      if name:sub(1, #root + 1):lower() == (root .. '/'):lower() then table.insert(open, name:sub(#root + 2)) end
    end
  end
  return {path = file:sub(#root + 2), uri = vim.uri_from_fname(file), text = text,
    documentVersion = vim.api.nvim_buf_get_changedtick(buf), dirty = vim.bo[buf].modified,
    cursor = start, selection = selection, openFiles = open,
    visibleRanges = {{start = {line = vim.fn.line('w0') - 1, column = 0}, ['end'] = {line = vim.fn.line('w$') - 1, column = utf16(lines[vim.fn.line('w$')] or '', #(lines[vim.fn.line('w$')] or ''))}}}}
end
local function receive(message)
  assert(message.version == '0.1', 'Unsupported oAX version')
  if message.type == 'response' and message.correlationId == 'adapter-bootstrap' then
    assert(message.ok and message.payload.contract == 'editor-read-only.v1', 'Invalid adapter bootstrap')
    state.identity, state.session = message.payload.workspaceId, message.payload.sessionId
    return
  end
  assert(message.workspaceId == state.identity, 'oAX workspace mismatch')
  if message.type == 'event' then
    assert(message.sessionId == state.session and message.sequence > (state.sequence or 0), 'Invalid event scope/order')
    state.sequence = message.sequence
    table.insert(state.events, message)
    if #state.events > 100 then table.remove(state.events, 1) end
    vim.api.nvim_exec_autocmds('User', {pattern = 'OaxEvent', data = message})
  elseif message.type == 'response' then
    local callback = state.pending[message.correlationId]
    assert(callback, 'Uncorrelated oAX response')
    state.pending[message.correlationId] = nil
    callback(message)
  else error('Invalid oAX message type') end
end
function M.request(method, payload, callback)
  assert(state.session, 'oAX not connected yet')
  state.serial = state.serial + 1
  local id = 'nvim-' .. state.serial
  state.pending[id] = callback or function(message)
    if not message.ok then vim.notify(message.error.code .. ': ' .. message.error.message, vim.log.levels.ERROR); return end
    local buf = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_buf_set_name(buf, 'oax-result://' .. id)
    local text = type(message.payload) == 'string' and message.payload or vim.inspect(message.payload)
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, vim.split(text, '\n', {plain = true}))
    vim.bo[buf].modifiable = false
    vim.cmd('botright split'); vim.api.nvim_win_set_buf(0, buf)
  end
  vim.fn.chansend(state.job, vim.json.encode({type = 'request', version = '0.1', id = id,
    timestamp = os.date('!%Y-%m-%dT%H:%M:%SZ'), workspaceId = state.identity, sessionId = state.session,
    method = method, payload = payload}) .. '\n')
end
function M.setup(options)
  assert(not state.job, 'oAX already connected; close before reconnecting')
  assert(options.root and options.cli, 'Configure trusted root and absolute built CLI path')
  state.generation = state.generation + 1
  local generation = state.generation
  state.root = vim.fn.fnamemodify(options.root, ':p'):gsub('[\\/]$', '')
  state.job = vim.fn.jobstart({options.node or 'node', options.cli, 'editor-bridge', state.root}, {
    overlapped = true,
    on_stdout = function(_, chunks)
      if generation ~= state.generation then return end
      local data = state.remainder .. table.concat(chunks, '\n')
      local parts = vim.split(data, '\n', {plain = true})
      state.remainder = table.remove(parts) or ''
      if #state.remainder > 262144 then M.close(); return end
      vim.schedule(function()
        if generation ~= state.generation then return end
        for _, line in ipairs(parts) do
          if #line > 262144 then M.close(); return end
          local ok, error = pcall(function() receive(vim.json.decode(line)) end)
          if not ok then vim.notify(tostring(error), vim.log.levels.ERROR); M.close(); return end
        end
      end)
    end,
    on_exit = function() vim.schedule(function()
      if generation ~= state.generation then return end
      state.job, state.session, state.identity = nil, nil, nil
      for _, callback in pairs(state.pending) do callback({ok = false, error = {code = 'DISCONNECTED', message = 'oAX runtime disconnected'}}) end
      state.pending = {}
    end) end,
  })
  assert(state.job > 0, 'Unable to start oAX bridge')
  vim.api.nvim_create_user_command('OaxCallers', function() M.request('graph.query', {observation = M.capture(), relationship = 'callers'}) end, {force = true})
  vim.api.nvim_create_user_command('OaxObserve', function() M.request('spatial.observe', {observation = M.capture()}) end, {force = true})
  vim.api.nvim_create_user_command('OaxContext', function(command)
    local snapshot = M.capture()
    local last = vim.api.nvim_buf_get_lines(0, command.line2 - 1, command.line2, false)[1] or ''
    snapshot.selection = {start = {line = command.line1 - 1, column = 0}, ['end'] = {line = command.line2 - 1, column = utf16(last, #last)}}
    M.request('context.preview', {observation = snapshot, objective = command.args ~= '' and command.args or 'Explain current code'})
  end, {nargs = '*', range = true, force = true})
  vim.api.nvim_create_user_command('OaxExplainMock', function() M.request('selection.explain', {observation = M.capture(), objective = 'Explain current code using the explicitly selected mock engine'}) end, {force = true})
  vim.api.nvim_create_autocmd('VimLeavePre', {callback = M.close, once = true})
end
function M.inspect() return {connected = state.session ~= nil, events = vim.deepcopy(state.events)} end
function M.close()
  state.generation = state.generation + 1
  if state.job then vim.fn.jobstop(state.job) end
  state.job, state.session, state.identity = nil, nil, nil
  state.events, state.sequence, state.remainder = {}, nil, ''
  local pending = state.pending
  state.pending = {}
  for _, callback in pairs(pending) do pcall(callback, {ok = false, error = {code = 'DISCONNECTED', message = 'oAX connection closed'}}) end
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do if vim.api.nvim_buf_is_valid(buf) then vim.api.nvim_buf_clear_namespace(buf, namespace, 0, -1) end end
end
return M
