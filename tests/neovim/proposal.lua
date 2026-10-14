local oax = require('oax')
local root, repo = vim.env.OAX_LIVE_WORKSPACE, vim.env.OAX_REPO
local file = root .. '/example.mjs'
vim.cmd.edit(vim.fn.fnameescape(file))
local source, window = vim.api.nvim_get_current_buf(), vim.api.nvim_get_current_win()
local original = table.concat(vim.fn.readfile(file), '\n')
oax.setup({root=root,cli=repo .. '/dist/cli.cjs',node=vim.env.OAX_NODE,codex=vim.env.OAX_CODEX_EXECUTABLE,edits=true,tests=true})
assert(vim.wait(60000,function() return oax.inspect().connected or oax.inspect().error end,20))
assert(oax.inspect().connected,oax.inspect().error)
local function call(method,payload)
  local response
  oax.request(method,payload,function(r) response=r end)
  assert(vim.wait(30000,function() return response~=nil end,20),method)
  return response
end
local missing=call('refactor.propose',{observation=oax.capture(),proposal='{"replacement":"bad","explanation":"bad"}'})
assert(not missing.ok and missing.error.code=='PERMISSION_DENIED')
local native=vim.ui.select
local phase, sends, writes, tested='cancel-send',0,0,false
vim.ui.select=function(items,options,callback)
  assert(items[1]=='Cancel' and not vim.bo.modifiable)
  if items[2]=='Send to Codex' then
    sends=sends+1
    local text=table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\n')
    assert(text:find('a + b',1,true) and text:find('hash =',1,true))
    vim.api.nvim_feedkeys(phase=='cancel-send' and '1\r' or '2\r','nt',false)
  elseif items[2]=='Apply edit' then
    writes=writes+1
    assert(table.concat(vim.fn.readfile(file),'\n')==original,'Provider or plan wrote before approval')
    local text=table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\n')
    assert(text:find('BEFORE:',1,true) and text:find('AFTER:',1,true) and text:find('Unverified Codex proposal',1,true))
    vim.api.nvim_feedkeys(phase=='apply' and '2\r' or '1\r','nt',false)
  elseif items[2]=='Run test' then
    tested=true
    assert(options.prompt:find('local-account rights',1,true))
    vim.api.nvim_feedkeys('2\r','nt',false)
  else error('Unexpected approval') end
  native(items,options,callback)
end
local function propose()
  vim.api.nvim_set_current_win(window)
  vim.api.nvim_win_set_buf(window,source)
  vim.cmd('1OaxPropose Change add to subtract b from a. Return exactly export function add(a, b) { return a - b; } as the replacement. Keep the function name and parameters.')
end
propose()
assert(vim.wait(30000,function() return sends==1 end,20))
assert(#oax.inspect().events==0 and table.concat(vim.fn.readfile(file),'\n')==original)
phase='cancel-write'
propose()
assert(vim.wait(90000,function() return writes==1 end,20),'No provider diff for cancel')
assert(table.concat(vim.fn.readfile(file),'\n')==original,'Cancelling diff changed source')
phase='apply'
propose()
assert(vim.wait(90000,function() return writes==2 end,20),'No provider diff for apply')
assert(vim.wait(10000,function() return table.concat(vim.fn.readfile(file),'\n')~=original end,20),'No approved edit')
local changed=table.concat(vim.fn.readfile(file),'\n')
assert(changed:find('return a - b',1,true) and changed:find('// preserved outside selection',1,true),changed)
assert(vim.wait(5000,function() return table.concat(vim.api.nvim_buf_get_lines(source,0,-1,false),'\n')==changed end,20))
local review=call('review.get',vim.empty_dict())
assert(review.ok and review.payload.current and not review.payload.verified)
vim.api.nvim_set_current_win(window)
vim.cmd.edit(vim.fn.fnameescape(root .. '/proposal.test.mjs'))
local count=#oax.inspect().events
vim.cmd('OaxVerify')
assert(vim.wait(20000,function()
  local events=oax.inspect().events
  for i=count+1,#events do if events[i].method=='task.state' and events[i].payload.state=='completed' then return true end end
  return false
end,20),'Verification did not complete')
local verified=call('review.get',vim.empty_dict())
assert(tested and verified.ok and verified.payload.verified and verified.payload.check.exitCode==0,vim.inspect(verified))
vim.fn.writefile({vim.json.encode({verified=true,engine='codex',proposal=true,cancelledSend=true,cancelledWrite=true,applied=true,tested=true,preservedUnselected=true})},root .. '/acceptance.json')
oax.close()
print('NEOVIM PROPOSAL PASSED: native cancel-send/cancel-write, actual Codex proposal, separately approved edit and real Node verification')
vim.cmd('qa!')
