local P = {}
local namespace = vim.api.nvim_create_namespace('oax-agent')
local state = {generation = 0, marks = {}, count = 0}
local api
local function clear()
  for buf, _ in pairs(state.marks) do
    if vim.api.nvim_buf_is_valid(buf) then vim.api.nvim_buf_clear_namespace(buf, namespace, 0, -1) end
  end
  state.marks = {}
end
local function text(buf)
  return table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false), '\n') .. (vim.bo[buf].endofline and '\n' or '')
end
local function byte_column(line, column)
  if type(column) ~= 'number' or column < 0 or column % 1 ~= 0 then return nil end
  local i, units = 1, 0
  while i <= #line and units < column do
    local lead = line:byte(i)
    local bytes = lead < 128 and 1 or lead < 224 and 2 or lead < 240 and 3 or 4
    units = units + (bytes == 4 and 2 or 1)
    i = i + bytes
  end
  if units ~= column then return nil end
  return i - 1
end
local function signature(snapshot)
  return table.concat({snapshot.path, snapshot.documentVersion, tostring(snapshot.dirty),
    snapshot.cursor.line, snapshot.cursor.column, snapshot.selection.start.line,
    snapshot.selection.start.column, snapshot.selection['end'].line, snapshot.selection['end'].column,
    vim.inspect(snapshot.visibleRanges), vim.inspect(snapshot.openFiles), vim.fn.sha256(snapshot.text)}, '|')
end
local function capture()
  if vim.bo.buftype ~= '' then return nil end
  local ok, snapshot = pcall(api.capture)
  if not ok or #snapshot.text > 131072 or #vim.json.encode({observation = snapshot}) > 240000 then return nil end
  return snapshot
end
function P.schedule()
  if not api or not api.connected() or not api.observe then return end
  state.ticket = (state.ticket or 0) + 1
  local ticket, generation = state.ticket, state.generation
  vim.defer_fn(function()
    if generation ~= state.generation or ticket ~= state.ticket or not api or not api.connected() then return end
    if not api.idle() then P.schedule(); return end
    local snapshot = capture()
    if not snapshot then state.observed, state.signature = nil, nil; return end
    local stamp = signature(snapshot)
    if stamp == state.signature then return end
    state.observed, state.signature = nil, nil
    vim.cmd('redrawstatus')
    api.request('spatial.observe', {observation = snapshot}, function(response)
      if generation ~= state.generation or not api then return end
      local current = capture()
      if not current or signature(current) ~= stamp then P.schedule(); return end
      if not response.ok then
        -- Retry busy responses; exclusions/errors wait for a new editor event.
        if response.error.code == 'BUSY' or response.error.code == 'TASK_BUSY' then P.schedule() end
        return
      end
      if response.payload.documentVersion ~= snapshot.documentVersion then return end
      local focused = response.payload.focused
      if focused and (focused.path ~= snapshot.path or focused.hash ~= vim.fn.sha256(snapshot.text)) then return end
      state.signature = stamp
      state.observed = {path = snapshot.path, documentVersion = snapshot.documentVersion, focused = response.payload.focused}
      state.count = state.count + 1
      vim.cmd('redrawstatus')
    end)
  end, 250)
end
function P.event(event)
  if not api or not api.connected() then return end
  if event.method == 'task.state' then
    state.phase = event.payload.state
    if state.phase == 'created' or state.phase == 'completed' or state.phase == 'failed' or state.phase == 'cancelled' then clear() end
    vim.cmd('redrawstatus')
    return
  end
  if event.method ~= 'agent.cursor.changed' then return end
  clear()
  local location = event.payload
  if type(location.contentHash) ~= 'string' or not location.contentHash:match('^[a-f0-9]+$') or #location.contentHash ~= 64 then return end
  if type(location.path) ~= 'string' or location.path:match('^[/\\]') or location.path:find(':', 1, true) then return end
  for part in location.path:gmatch('[^/\\]+') do if part == '..' or part == '.' then return end end
  local root = vim.fs.normalize(api.root):gsub('/$', '')
  local target = vim.fs.normalize(root .. '/' .. location.path)
  local range = location.range
  if not range or not range.start or not range['end'] then return end
  for _, win in ipairs(vim.api.nvim_list_wins()) do
    local buf = vim.api.nvim_win_get_buf(win)
    local file = vim.fs.normalize(vim.api.nvim_buf_get_name(buf))
    if vim.fn.has('win32') == 1 then file, target = file:lower(), target:lower() end
    if file == target and not state.marks[buf] and
      (location.documentVersion == nil or location.documentVersion == vim.api.nvim_buf_get_changedtick(buf)) and
      vim.fn.sha256(text(buf)) == location.contentHash then
      local first, last = range.start, range['end']
      local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
      if type(first.line) ~= 'number' or type(last.line) ~= 'number' or first.line < 0 or last.line < first.line or first.line % 1 ~= 0 or last.line % 1 ~= 0 then return end
      local start_line, end_line = lines[first.line + 1], lines[last.line + 1]
      if start_line and end_line then
        local start_col, end_col = byte_column(start_line, first.column), byte_column(end_line, last.column)
        if start_col and end_col and (last.line > first.line or end_col >= start_col) then
          local ok = pcall(vim.api.nvim_buf_set_extmark, buf, namespace, first.line, start_col, {
            end_row = last.line, end_col = end_col, hl_group = 'Search',
            virt_text = {{'oAX ' .. location.mode, 'Comment'}}, virt_text_pos = 'eol',
          })
          if ok then state.marks[buf] = true end
        end
      end
    end
  end
end
function P.start(options)
  P.close()
  api = options
  api.root = vim.fs.normalize(vim.fn.fnamemodify(options.root, ':p'))
  state.count = 0
  local group = vim.api.nvim_create_augroup('OaxPresence', {clear = true})
  vim.api.nvim_create_autocmd({'CursorMoved', 'CursorMovedI', 'BufEnter', 'WinScrolled'}, {
    group = group, callback = P.schedule,
  })
  vim.api.nvim_create_autocmd({'TextChanged', 'TextChangedI', 'BufWritePost', 'BufLeave', 'BufWipeout'}, {
    group = group, callback = function()
      clear(); state.observed, state.signature = nil, nil
      P.schedule()
    end,
  })
end
function P.close()
  state.generation = state.generation + 1
  clear()
  pcall(vim.api.nvim_del_augroup_by_name, 'OaxPresence')
  state.observed, state.signature, state.phase = nil, nil, nil
  api = nil
end
function P.inspect()
  return {observed = vim.deepcopy(state.observed), observations = state.count, phase = state.phase, markedBuffers = vim.tbl_keys(state.marks)}
end
function P.status()
  if not api or not api.connected() then return 'oAX: offline' end
  return 'oAX: ' .. (state.phase or (state.observed and 'observing' or 'idle'))
end
return P
