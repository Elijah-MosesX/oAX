local oax = require('oax')
local root, repo = vim.env.OAX_LIVE_WORKSPACE, vim.env.OAX_REPO
assert(root and vim.env.OAX_CODEX_EXECUTABLE)
vim.cmd.edit(vim.fn.fnameescape(root .. '/example.mjs'))
local source, window = vim.api.nvim_get_current_buf(), vim.api.nvim_get_current_win()
local original = vim.api.nvim_buf_get_lines(source, 0, -1, false)
local cursor = vim.api.nvim_win_get_cursor(window)
oax.setup({root=root, cli=repo .. '/dist/cli.cjs', node=vim.env.OAX_NODE, codex=vim.env.OAX_CODEX_EXECUTABLE})
assert(vim.wait(60000, function() return oax.inspect().connected or oax.inspect().error end, 20), 'Codex bridge startup timed out')
assert(oax.inspect().connected, oax.inspect().error or 'Codex bridge startup failed')
assert(oax.inspect().engine == 'codex')
local function call(method, payload)
  local response
  oax.request(method, payload, function(message) response=message end)
  assert(vim.wait(80000,function() return response ~= nil end,20),'No response for ' .. method)
  return response
end
vim.cmd('normal! V')
local captured = oax.capture()
vim.cmd('normal! \027')
local selection = {observation=captured, objective='Explain this synthetic addition function'}
local missing = call('selection.explain',selection)
assert(not missing.ok and missing.error.code=='PERMISSION_DENIED')
local preview = call('context.preview',selection)
assert(preview.ok)
local changed = vim.deepcopy(selection)
changed.objective = 'A different objective'
changed.approvedContextHash = preview.payload.hash
local stale = call('selection.explain',changed)
assert(not stale.ok and stale.error.code=='PERMISSION_DENIED')
local forbidden=call('refactor.apply',{})
assert(not forbidden.ok and forbidden.error.code=='UNSUPPORTED_METHOD')

-- Drive the native vim.ui.select/inputlist with queued input, never a production approval bypass.
local native_select = vim.ui.select
local prompts, approved = 0, false
vim.ui.select = function(items, options, callback)
  prompts = prompts + 1
  assert(items[1]=='Cancel' and items[2]=='Send to Codex')
  assert(not vim.bo.modifiable, 'Preview is read-only before consent')
  local text=table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\n')
  assert(text:find('hash =',1,true) and text:find('a + b',1,true),'Inspect actual preview')
  local choose = approved and '2\r' or '1\r'
  vim.api.nvim_feedkeys(choose,'nt',false)
  native_select(items, options, callback)
end
vim.cmd('OaxExplain Explain this synthetic addition function')
assert(vim.wait(30000,function() return prompts==1 end,20),'No cancel prompt')
assert(#oax.inspect().events==0,'Cancellation must not start a task')
vim.api.nvim_set_current_win(window)
approved=true
vim.cmd('OaxExplain Explain this synthetic addition function')
assert(vim.wait(90000,function()
  local events=oax.inspect().events
  return #events>0 and events[#events].method=='task.state' and events[#events].payload.state=='completed'
end,20),'Codex task did not complete')
assert(vim.wait(5000,function()
  return vim.api.nvim_get_current_buf()~=source and not vim.api.nvim_buf_get_name(0):find('preview',1,true)
end,20),'No explanation buffer')
local answer=table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\n')
assert(answer:lower():find('add') or answer:lower():find('sum'), answer)
assert(not answer:find('Mock engine',1,true))
assert(vim.deep_equal(original,vim.api.nvim_buf_get_lines(source,0,-1,false)))
assert(vim.deep_equal(cursor,vim.api.nvim_win_get_cursor(window)))
assert(not vim.bo[source].modified)
vim.fn.writefile({vim.json.encode({verified=true,engine='codex',prompts=prompts,deniedMissing=true,deniedStale=true,cancelled=true,preservedSource=true,answer=answer})},root .. '/acceptance.json')
oax.close()
print('NEOVIM LIVE PASSED: native preview/cancel/consent -> real Codex -> answer; stale approvals and writes denied; source/cursor preserved')
vim.cmd('qa!')
