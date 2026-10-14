local oax=require('oax')
local presence=require('oax.presence')
local repo=vim.env.OAX_REPO
local root=repo .. '/tests/fixtures/workspace'
vim.cmd.edit(vim.fn.fnameescape(root .. '/example.ts'))
vim.api.nvim_buf_set_lines(0,0,-1,false,{'// 😀 unicode','export function first() { return 1; }','export function second() { return first(); }'})
local source,window=vim.api.nvim_get_current_buf(),vim.api.nvim_get_current_win()
vim.api.nvim_win_set_cursor(window,{2,18})
oax.setup({root=root,cli=repo .. '/dist/cli.cjs',node=vim.env.OAX_NODE})
assert(vim.wait(60000,function() return oax.inspect().connected end,20))
assert(vim.wait(5000,function() return oax.inspect().backgroundObservation end,1),'No in-flight observation')
local foreground
oax.request('graph.query',{observation=oax.capture(),relationship='callers'},function(r)foreground=r end)
assert(vim.wait(30000,function() return foreground~=nil end,20))
assert(foreground.ok,'Foreground command was rejected behind background observation: ' .. vim.inspect(foreground))
assert(vim.wait(5000,function() return oax.inspect().presence.observed~=nil end,20),'No automatic observation')
local observed=oax.inspect().presence.observed
assert(observed.focused.name=='first' and observed.documentVersion==vim.api.nvim_buf_get_changedtick(source),vim.inspect(observed))
assert(#oax.inspect().events==0,'Observation started an agent task')
assert(oax.status()=='oAX: observing')
local count=oax.inspect().presence.observations
for _=1,20 do
  vim.api.nvim_win_set_cursor(window,{3,18})
  vim.api.nvim_exec_autocmds('CursorMoved',{})
end
assert(vim.wait(5000,function() return oax.inspect().presence.observations>count end,20))
assert(oax.inspect().presence.observations==count+1,'Cursor burst was not debounced')
assert(oax.inspect().presence.observed.focused.name=='second')
local cursor=vim.api.nvim_win_get_cursor(window)
local ns=vim.api.nvim_create_namespace('oax-agent')
local seen=false
vim.api.nvim_create_autocmd('User',{pattern='OaxEvent',callback=function(event)
  if event.data.method=='agent.cursor.changed' then
    local marks=vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{details=true})
    assert(#marks==1,'Actual agent event did not create indicator')
    assert(vim.deep_equal(cursor,vim.api.nvim_win_get_cursor(window)),'Indicator moved the cursor')
    seen=true
  end
end})
local result
local snapshot=oax.capture()
snapshot.selection={start={line=2,column=0},['end']={line=2,column=42}}
oax.request('selection.explain',{observation=snapshot,objective='Explain using mock'},function(r)result=r end)
assert(vim.wait(30000,function()return result~=nil end,20))
assert(result.ok and seen,vim.inspect(result))
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Terminal state left an active indicator')
-- Rendering validation with exact visible-buffer hash and UTF-16 surrogate boundaries.
local snapshot2=oax.capture()
local payload={path='example.ts',range={start={line=0,column=3},['end']={line=0,column=5}},mode='investigating',documentVersion=snapshot2.documentVersion,contentHash=vim.fn.sha256(snapshot2.text)}
presence.event({method='agent.cursor.changed',payload=payload})
local marks=vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{details=true})
assert(#marks==1 and marks[1][3]==3 and marks[1][4].end_col==7,vim.inspect(marks))
payload.range['end'].column=4
presence.event({method='agent.cursor.changed',payload=payload})
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Half-surrogate range rendered')
payload.range['end'].column=5
payload.contentHash=string.rep('a',64)
presence.event({method='agent.cursor.changed',payload=payload})
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Stale hash rendered')
payload.contentHash=nil
presence.event({method='agent.cursor.changed',payload=payload})
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Missing evidence rendered')
payload.contentHash=vim.fn.sha256(snapshot2.text)
payload.path='../example.ts'
presence.event({method='agent.cursor.changed',payload=payload})
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Out-of-scope path rendered')
payload.path='not-visible.ts'
presence.event({method='agent.cursor.changed',payload=payload})
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Invisible file rendered')
payload.path='example.ts'
payload.documentVersion=snapshot2.documentVersion-1
presence.event({method='agent.cursor.changed',payload=payload})
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Stale version rendered')
payload.documentVersion=snapshot2.documentVersion
presence.event({method='agent.cursor.changed',payload=payload})
vim.api.nvim_buf_set_lines(source,0,1,false,{'// changed'})
vim.api.nvim_exec_autocmds('TextChanged',{})
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Edit did not invalidate indicator')
presence.event({method='agent.cursor.changed',payload=payload})
assert(#vim.api.nvim_buf_get_extmarks(source,ns,0,-1,{})==0,'Late event restored stale indicator')
oax.close()
assert(oax.status()=='oAX: offline' and oax.inspect().presence.observed==nil)
-- Closing cancels pending callbacks, and busy operations defer background capture.
local requests,callback,busy=0,nil,true
presence.start({root=root,observe=true,connected=function()return true end,idle=function()return not busy end,capture=function()return snapshot2 end,
  request=function(_,_,cb)requests=requests+1;callback=cb end})
presence.schedule()
vim.wait(350,function()return false end,20)
assert(requests==0,'Background observation ran while busy')
busy=false
assert(vim.wait(1000,function()return callback~=nil end,20))
presence.close()
callback({ok=true,payload={documentVersion=snapshot2.documentVersion}})
assert(presence.inspect().observed==nil,'Late disconnected response restored observation')
-- Delayed replies must follow the current cursor and buffer, even at equal versions.
local current=vim.deepcopy(snapshot2)
local replies={}
presence.start({root=root,observe=true,connected=function()return true end,idle=function()return true end,
  capture=function()return current end,request=function(_,_,cb)table.insert(replies,cb) end})
local function response(snapshot, overrides)
  return {ok=true,payload={documentVersion=snapshot.documentVersion,focused=overrides or {
    path=snapshot.path,hash=vim.fn.sha256(snapshot.text),name='current'}}}
end
presence.schedule()
assert(vim.wait(1000,function()return #replies==1 end,20))
current.cursor.column=current.cursor.column+1
replies[1](response(snapshot2))
assert(presence.inspect().observed==nil,'Old cursor response restored focus')
assert(vim.wait(1000,function()return #replies==2 end,20))
local previous=vim.deepcopy(current)
current=vim.deepcopy(current)
current.path='other.ts'
replies[2](response(previous))
assert(presence.inspect().observed==nil,'Old buffer response restored focus')
assert(vim.wait(1000,function()return #replies==3 end,20))
replies[3](response(current,{path=current.path,hash=string.rep('a',64)}))
assert(presence.inspect().observed==nil,'Mismatched focus hash accepted')
presence.schedule()
assert(vim.wait(1000,function()return #replies==4 end,20))
replies[4](response(current,{path='wrong.ts',hash=vim.fn.sha256(current.text)}))
assert(presence.inspect().observed==nil,'Mismatched focus path accepted')
presence.schedule()
assert(vim.wait(1000,function()return #replies==5 end,20))
replies[5](response(current))
assert(presence.inspect().observed.path=='other.ts','Current buffer focus missing')
current.cursor.column=current.cursor.column+1
presence.schedule()
assert(vim.wait(1000,function()return #replies==6 end,20))
assert(presence.inspect().observed==nil,'Previous focus remained while new observation was pending')
presence.close()
oax.setup({root=root,cli=repo .. '/dist/cli.cjs',node=vim.env.OAX_NODE,observe=false})
assert(vim.wait(60000,function()return oax.inspect().connected end,20))
vim.api.nvim_exec_autocmds('CursorMoved',{})
vim.wait(350,function()return false end,20)
assert(oax.inspect().presence.observations==0,'observe=false was ignored')
oax.close()
-- Disconnect fails an explicit command queued behind an actual observation.
vim.api.nvim_set_current_win(window)
vim.api.nvim_win_set_buf(window,source)
oax.setup({root=root,cli=repo .. '/dist/cli.cjs',node=vim.env.OAX_NODE})
assert(vim.wait(60000,function()return oax.inspect().connected end,20))
assert(vim.wait(5000,function()return oax.inspect().backgroundObservation end,1))
local disconnected
oax.request('graph.query',{observation=oax.capture(),relationship='callers'},function(r)disconnected=r end)
oax.close()
assert(disconnected and not disconnected.ok and disconnected.error.code=='DISCONNECTED','Queued command lost on disconnect')
print('NEOVIM PRESENCE PASSED: automatic scoped observation, debounce, real agent indicator, UTF-16, stale-source rejection, delayed cursor/buffer replies, busy deferral, disconnect and opt-out')
vim.cmd('qa!')
