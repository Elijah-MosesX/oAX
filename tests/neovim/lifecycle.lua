local oax = require('oax')
local root, repo = vim.env.OAX_LIVE_WORKSPACE, vim.env.OAX_REPO
assert(root and vim.env.OAX_CODEX_EXECUTABLE)
vim.cmd.edit(vim.fn.fnameescape(root .. '/example.mjs'))
local source, window = vim.api.nvim_get_current_buf(), vim.api.nvim_get_current_win()
local original = vim.api.nvim_buf_get_lines(source, 0, -1, false)
local cursor = vim.api.nvim_win_get_cursor(window)
local options = {root=root,cli=repo .. '/dist/cli.cjs',node=vim.env.OAX_NODE,codex=vim.env.OAX_CODEX_EXECUTABLE}
local function connect()
  oax.setup(options)
  assert(vim.wait(60000,function()return oax.inspect().connected or oax.inspect().error end,20),'Startup timed out')
  assert(oax.inspect().connected,oax.inspect().error)
end
local function restore()
  vim.api.nvim_set_current_win(window)
  vim.api.nvim_win_set_buf(window,source)
end
local function call(method,payload)
  local response
  oax.request(method,payload,function(r)response=r end)
  assert(vim.wait(30000,function()return response~=nil end,20),'No response: ' .. method)
  return response
end
connect()
local native_select, pending_consent = vim.ui.select, nil
local hold, prompts = false, 0
vim.ui.select = function(items,config,callback)
  prompts=prompts+1
  assert(items[1]=='Cancel' and items[2]=='Send to Codex')
  assert(not vim.bo.modifiable,'Consent preview must be read-only')
  local preview=table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\n')
  assert(preview:find('hash =',1,true) and preview:find('a + b',1,true),'Missing actual synthetic preview')
  if hold then pending_consent=function()callback(items[2])end; return end
  vim.api.nvim_feedkeys('2\r','nt',false)
  native_select(items,config,callback)
end
local cancelled_task, cancelled_session, terminal, after_terminal = nil,nil,nil,0
local cancel = true
vim.api.nvim_create_autocmd('User',{pattern='OaxEvent',callback=function(event)
  local message=event.data
  if message.taskId==cancelled_task then
    if terminal then after_terminal=after_terminal+1 end
    if message.method=='task.state' and message.payload.state=='cancelled' then terminal=message end
  end
  if cancel and message.method=='agent.activity' and message.payload.kind=='turn' and message.payload.state=='started' then
    cancel=false
    cancelled_task,cancelled_session=message.taskId,message.sessionId
    vim.schedule(function()vim.cmd('OaxCancel')end)
  end
end})
vim.cmd('OaxExplain Explain the synthetic addition function in detail')
assert(vim.wait(90000,function()return terminal~=nil end,20),'Started provider turn was not cancelled')
assert(cancelled_task and terminal.sessionId==cancelled_session)
assert(oax.status()=='oAX: cancelled')
assert(#oax.inspect().presence.markedBuffers==0,'Cancelled task retained an indicator')
vim.wait(350,function()return false end,20)
assert(after_terminal==0,'Cancelled task emitted late activity')
restore()
local selection={observation=oax.capture(),objective='Explain this synthetic addition function'}
selection.observation.selection={start={line=0,column=0},['end']={line=0,column=#original[1]}}
local preview=call('context.preview',selection)
assert(preview.ok,vim.inspect(preview))
selection.approvedContextHash=preview.payload.hash
hold=true
vim.cmd('OaxExplain Explain this synthetic addition function')
assert(vim.wait(30000,function()return pending_consent~=nil end,20),'No pending consent')
oax.close()
assert(oax.status()=='oAX: offline' and oax.inspect().presence.observed==nil)
restore()
connect()
pending_consent()
assert(#oax.inspect().events==0,'Old UI consent started a task after reconnect')
restore()
local replay=call('selection.explain',selection)
assert(not replay.ok and replay.error.code=='PERMISSION_DENIED','Old connection receipt was accepted')
assert(#oax.inspect().events==0,'Rejected receipt started a task')
local recovered=vim.wait(10000,function()return oax.inspect().presence.observed~=nil end,20)
assert(recovered,'Spatial observation did not recover: ' .. vim.inspect({state=oax.inspect(),buffer=vim.api.nvim_buf_get_name(0),capture=oax.capture()}))
assert(oax.inspect().presence.observed.path=='example.mjs')
hold=false
vim.cmd('OaxExplain Explain this synthetic addition function briefly')
local completed
assert(vim.wait(90000,function()
  for _, event in ipairs(oax.inspect().events) do
    assert(event.sessionId~=cancelled_session,'Old session event leaked after reconnect')
    if event.method=='task.state' and event.payload.state=='completed' then completed=event; return true end
  end
  return false
end,20),'Freshly approved provider task did not complete')
assert(completed.taskId~=cancelled_task)
assert(vim.wait(10000,function()
  return vim.api.nvim_get_current_buf()~=source and not vim.api.nvim_buf_get_name(0):find('preview',1,true)
end,20),'No fresh explanation result')
local answer=table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\n'):lower()
assert(answer:find('add',1,true) or answer:find('sum',1,true),'Missing actual explanation')
assert(vim.deep_equal(original,vim.api.nvim_buf_get_lines(source,0,-1,false)))
assert(vim.deep_equal(cursor,vim.api.nvim_win_get_cursor(window)))
assert(not vim.bo[source].modified)
assert(#oax.inspect().presence.markedBuffers==0)
vim.fn.writefile({vim.json.encode({verified=true,engine='codex',lifecycle=true,prompts=prompts,
  cancelledStartedTurn=true,rejectedOldConsent=true,rejectedOldReceipt=true,freshSessionCompleted=true,
  spatialRecovered=true,preservedSource=true,cancelledTask=cancelled_task,completedTask=completed.taskId})},root .. '/acceptance.json')
oax.close()
print('NEOVIM LIFECYCLE PASSED: actual provider turn cancelled, old consent/receipt rejected after reconnect, fresh spatial focus and provider completion')
vim.cmd('qa!')
