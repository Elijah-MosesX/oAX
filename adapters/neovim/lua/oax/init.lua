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
local display
local function receive(message)
  assert(message.version == '0.1', 'Unsupported oAX version')
  if message.type == 'response' and message.correlationId == 'adapter-bootstrap' then
    local expected = state.tests and 'editor-verification.v1' or state.edits and 'editor-reviewed-rename.v1' or state.codex and 'editor-codex-text.v1' or 'editor-read-only.v1'
    assert(message.ok and message.payload.contract == expected and message.payload.engine == (state.codex and 'codex' or 'mock'), 'Invalid adapter bootstrap')
    state.identity, state.session = message.payload.workspaceId, message.payload.sessionId
    return
  end
  assert(message.workspaceId == state.identity, 'oAX workspace mismatch')
  if message.type == 'event' then
    assert(message.sessionId == state.session and message.sequence > (state.sequence or 0), 'Invalid event scope/order')
    state.sequence = message.sequence
    if message.method == 'task.state' then
      local phase = message.payload.state
      state.task = (phase ~= 'completed' and phase ~= 'failed' and phase ~= 'cancelled') and message.taskId or nil
    end
    if state.check and state.check.id == message.taskId then
      if message.method == 'agent.delta' then state.check.output = (state.check.output .. message.payload.text):sub(1, 8000) end
      if message.method == 'task.state' and (message.payload.state == 'completed' or message.payload.state == 'failed' or message.payload.state == 'cancelled') then
        local check = state.check
        state.check = nil
        display({ok = true, payload = {state = message.payload.state, error = message.payload.error, output = check.output, planId = check.id}}, check.id .. '-verification')
      end
    end
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
display = function(message, id)
    if not message.ok then vim.notify(message.error.code .. ': ' .. message.error.message, vim.log.levels.ERROR); return end
    local buf = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_buf_set_name(buf, 'oax-result://' .. id)
    local text = type(message.payload) == 'string' and message.payload or vim.inspect(message.payload)
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, vim.split(text, '\n', {plain = true}))
    vim.bo[buf].modifiable = false
    if state.result_window and vim.api.nvim_win_is_valid(state.result_window) and vim.api.nvim_buf_get_name(vim.api.nvim_win_get_buf(state.result_window)):find('oax-result://', 1, true) == 1 then
      vim.api.nvim_set_current_win(state.result_window)
    else
      vim.cmd('botright split')
      state.result_window = vim.api.nvim_get_current_win()
    end
    vim.api.nvim_win_set_buf(0, buf)
end
function M.request(method, payload, callback)
  assert(state.session, 'oAX not connected yet')
  state.serial = state.serial + 1
  local id = 'nvim-' .. state.serial
  state.pending[id] = callback or function(message) display(message, id) end
  vim.fn.chansend(state.job, vim.json.encode({type = 'request', version = '0.1', id = id,
    timestamp = os.date('!%Y-%m-%dT%H:%M:%SZ'), workspaceId = state.identity, sessionId = state.session,
    method = method, payload = payload}) .. '\n')
end
local function line_snapshot(command)
  local snapshot = M.capture()
  local last = vim.api.nvim_buf_get_lines(0, command.line2 - 1, command.line2, false)[1] or ''
  snapshot.selection = {start = {line = command.line1 - 1, column = 0}, ['end'] = {line = command.line2 - 1, column = utf16(last, #last)}}
  return snapshot
end
function M.setup(options)
  assert(not state.job, 'oAX already connected; close before reconnecting')
  assert(options.root and options.cli, 'Configure trusted root and absolute built CLI path')
  state.generation = state.generation + 1
  local generation = state.generation
  state.error = nil
  state.root = vim.fn.fnamemodify(options.root, ':p'):gsub('[\\/]$', '')
  state.codex = options.codex
  state.edits = options.edits == true
  state.tests = options.tests == true
  local argv = {options.node or 'node', options.cli, 'editor-bridge', state.root}
  if options.codex then
    assert(vim.fn.fnamemodify(options.codex, ':p') == options.codex or vim.fs.normalize(vim.fn.fnamemodify(options.codex, ':p')) == vim.fs.normalize(options.codex), 'Configure an absolute Codex executable')
    vim.list_extend(argv, {'--codex', options.codex})
  end
  if state.edits then table.insert(argv, '--edits') end
  if state.tests then table.insert(argv, '--tests') end
  state.job = vim.fn.jobstart(argv, {
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
    on_exit = function(_, code) vim.schedule(function()
      if generation ~= state.generation then return end
      if not state.session then
        state.error = 'oAX bridge exited before initialization (code ' .. code .. '); check executable and provider login'
        vim.notify(state.error, vim.log.levels.ERROR)
      end
      state.job, state.session, state.identity, state.task, state.check = nil, nil, nil, nil, nil
      for _, callback in pairs(state.pending) do callback({ok = false, error = {code = 'DISCONNECTED', message = 'oAX runtime disconnected'}}) end
      state.pending = {}
    end) end,
  })
  assert(state.job > 0, 'Unable to start oAX bridge')
  vim.api.nvim_create_user_command('OaxCallers', function() M.request('graph.query', {observation = M.capture(), relationship = 'callers'}) end, {force = true})
  vim.api.nvim_create_user_command('OaxObserve', function() M.request('spatial.observe', {observation = M.capture()}) end, {force = true})
  vim.api.nvim_create_user_command('OaxContext', function(command)
    M.request('context.preview', {observation = line_snapshot(command), objective = command.args ~= '' and command.args or 'Explain current code'})
  end, {nargs = '*', range = true, force = true})
  vim.api.nvim_create_user_command('OaxExplain', function(command)
    assert(state.codex, 'Configure codex explicitly; no mock fallback')
    local snapshot = line_snapshot(command)
    local source = vim.api.nvim_get_current_buf()
    local expected_generation, session = state.generation, state.session
    local payload = {observation = snapshot, objective = command.args ~= '' and command.args or 'Explain current code'}
    M.request('context.preview', payload, function(message)
      display(message, message.correlationId .. '-preview')
      if not message.ok then return end
      vim.ui.select({'Cancel', 'Send to Codex'}, {prompt = 'Send this preview using your existing provider login? Usage may be charged.'}, function(choice)
        if choice ~= 'Send to Codex' then return end
        if expected_generation ~= state.generation or session ~= state.session or not vim.api.nvim_buf_is_valid(source) or vim.api.nvim_buf_get_changedtick(source) ~= snapshot.documentVersion then
          vim.notify('Context changed or connection closed; preview again', vim.log.levels.WARN); return
        end
        payload.approvedContextHash = message.payload.hash
        M.request('selection.explain', payload)
      end)
    end)
  end, {nargs = '*', range = true, force = true})
  vim.api.nvim_create_user_command('OaxRename', function(command)
    assert(state.edits, 'Enable edits explicitly in trusted oAX setup')
    local snapshot = M.capture()
    assert(not snapshot.dirty, 'Save the selected buffer before preparing a rename')
    snapshot.selection = {start = snapshot.cursor, ['end'] = snapshot.cursor}
    local source = vim.api.nvim_get_current_buf()
    local expected_generation, session = state.generation, state.session
    M.request('refactor.prepare', {observation = snapshot, newName = command.args}, function(message)
      if not message.ok then display(message, 'rename-error'); return end
      local plan = message.payload
      -- Capture every loaded affected buffer; disk validation remains runtime-owned.
      local ticks = {}
      local function buffers_unchanged(record)
        for _, buf in ipairs(vim.api.nvim_list_bufs()) do
          if vim.api.nvim_buf_is_loaded(buf) then
            local name = vim.fs.normalize(vim.api.nvim_buf_get_name(buf)):lower()
            for _, change in ipairs(plan.changes) do
              if name == vim.fs.normalize(state.root .. '/' .. change.path):lower() then
                if vim.bo[buf].modified or (not record and ticks[buf] and ticks[buf] ~= vim.api.nvim_buf_get_changedtick(buf)) then return false end
                if record then ticks[buf] = vim.api.nvim_buf_get_changedtick(buf) end
              end
            end
          end
        end
        return true
      end
      if not buffers_unchanged(true) then vim.notify('An affected buffer has unsaved changes; save and preview again', vim.log.levels.WARN); return end
      local lines = {'Rename plan: ' .. plan.id, 'Approval hash: ' .. plan.hash, plan.verification, ''}
      for _, change in ipairs(plan.changes) do
        vim.list_extend(lines, {'FILE: ' .. change.path, 'BEFORE:', change.before, 'AFTER:', change.after, ''})
      end
      display({ok = true, payload = table.concat(lines, '\n')}, message.correlationId .. '-rename')
      vim.ui.select({'Cancel', 'Apply rename'}, {prompt = 'Write the exact reviewed files? Tests are not run.'}, function(choice)
        if choice ~= 'Apply rename' then return end
        if expected_generation ~= state.generation or session ~= state.session or not vim.api.nvim_buf_is_valid(source) or vim.api.nvim_buf_get_changedtick(source) ~= snapshot.documentVersion or not buffers_unchanged(false) then
          vim.notify('Affected buffers or connection changed; preview again', vim.log.levels.WARN); return
        end
        M.request('refactor.apply', {planId = plan.id, approvedHash = plan.hash, observation = snapshot}, function(result)
          -- Native checktime preserves a buffer edited while the disk operation was running.
          for buf, _ in pairs(ticks) do
            if vim.api.nvim_buf_is_loaded(buf) and not vim.bo[buf].modified then
              local autoread = vim.bo[buf].autoread
              vim.bo[buf].autoread = true
              local ok, err = pcall(vim.cmd, 'checktime ' .. buf)
              vim.bo[buf].autoread = autoread
              if not ok then vim.notify(tostring(err), vim.log.levels.WARN) end
            end
          end
          display(result, message.correlationId .. '-applied')
        end)
      end)
    end)
  end, {nargs = 1, force = true})
  vim.api.nvim_create_user_command('OaxReview', function()
    assert(state.edits or state.tests, 'Enable edits or tests explicitly in trusted oAX setup')
    M.request('review.get', vim.empty_dict())
  end, {force = true})
  vim.api.nvim_create_user_command('OaxVerify', function()
    assert(state.tests, 'Enable tests explicitly in trusted oAX setup')
    local snapshot = M.capture()
    assert(not snapshot.dirty, 'Save the selected test before verification')
    local source = vim.api.nvim_get_current_buf()
    local expected_generation, session = state.generation, state.session
    M.request('verification.prepare', {observation = snapshot}, function(message)
      if not message.ok then display(message, 'verification-error'); return end
      local plan = message.payload
      display(message, message.correlationId .. '-test-preview')
      vim.ui.select({'Cancel', 'Run test'}, {prompt = plan.disclosure}, function(choice)
        if choice ~= 'Run test' then return end
        if expected_generation ~= state.generation or session ~= state.session or not vim.api.nvim_buf_is_valid(source) or vim.api.nvim_buf_get_changedtick(source) ~= snapshot.documentVersion or vim.bo[source].modified then
          vim.notify('Test buffer or connection changed; preview again', vim.log.levels.WARN); return
        end
        state.check = {id = plan.id, output = ''}
        M.request('verification.run', {planId = plan.id, approvedHash = plan.hash}, function(result)
          if not result.ok then state.check = nil; display(result, plan.id .. '-error') end
        end)
      end)
    end)
  end, {force = true})
  vim.api.nvim_create_user_command('OaxCancel', function()
    if state.task then M.request('task.cancel', {taskId = state.task}, function() end) end
  end, {force = true})
  vim.api.nvim_create_user_command('OaxExplainMock', function()
    assert(not state.codex, 'Mock command is unavailable in Codex mode')
    M.request('selection.explain', {observation = M.capture(), objective = 'Explain current code using the explicitly selected mock engine'})
  end, {force = true})
  vim.api.nvim_create_autocmd('VimLeavePre', {callback = M.close, once = true})
end
function M.inspect() return {connected = state.session ~= nil, engine = state.codex and 'codex' or 'mock', error = state.error, events = vim.deepcopy(state.events)} end
function M.close()
  state.generation = state.generation + 1
  if state.job then vim.fn.jobstop(state.job) end
  state.job, state.session, state.identity, state.task = nil, nil, nil, nil
  state.events, state.sequence, state.remainder = {}, nil, ''
  local pending = state.pending
  state.pending = {}
  for _, callback in pairs(pending) do pcall(callback, {ok = false, error = {code = 'DISCONNECTED', message = 'oAX connection closed'}}) end
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do if vim.api.nvim_buf_is_valid(buf) then vim.api.nvim_buf_clear_namespace(buf, namespace, 0, -1) end end
end
return M
