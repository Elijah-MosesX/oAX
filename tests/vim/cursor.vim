set encoding=utf-8
set nomore
set hidden
let g:oax_acceptance=1
let g:oax_observe=0
execute 'set runtimepath^=' . fnameescape($OAX_TEST_REPO . '/adapters/vim')
runtime plugin/oax.vim
execute 'edit ' . fnameescape($OAX_TEST_ROOT . '/sample.ts')
let g:source=bufnr('%')
call cursor(2,17)
let g:before=getpos('.')
let g:original=getline(1,'$')
function! Wait(expression) abort
  let deadline=reltime()
  while !eval(a:expression) && reltimefloat(reltime(deadline)) < 10
    sleep 5m
  endwhile
  if !eval(a:expression)
    call assert_report(a:expression . ': ' . json_encode(oax#inspect()))
    call writefile([json_encode({'errors':v:errors})],$OAX_TEST_RESULT)
    cquit
  endif
endfunction
let g:seen=0
function! ObserveEvent() abort
  let event=oax#inspect().events[-1]
  if event.method ==# 'agent.cursor.changed'
    call assert_equal([g:source],oax#inspect().markedBuffers)
    call assert_false(empty(prop_list(2,{'types':['oax-agent']})))
    call assert_equal(g:before,getpos('.'))
    let g:seen+=1
  endif
endfunction
autocmd User OaxEvent call ObserveEvent()
call oax#connect($OAX_TEST_ROOT,$OAX_TEST_CLI,$OAX_TEST_NODE)
call Wait('oax#inspect().connected')
let snapshot=oax#capture()
let snapshot.selection={'start':{'line':1,'column':0},'end':{'line':1,'column':strlen(getline(2))}}
call oax#request('selection.explain',{'observation':snapshot,'objective':'Explain using mock'})
call Wait('oax#inspect().pending == 0')
call assert_true(get(oax#inspect().result,'ok',0))
call assert_equal(1,g:seen)
call assert_true(empty(oax#inspect().markedBuffers))
call assert_true(empty(prop_list(2,{'types':['oax-agent']})))
autocmd! User OaxEvent
call oax#close()

call oax#connect($OAX_TEST_ROOT,$OAX_TEST_REPO . '/tests/vim/delayed-bridge.mjs',$OAX_TEST_NODE)
call Wait('oax#inspect().connected')
let g:snapshot=oax#capture()
let g:snapshot.selection={'start':{'line':0,'column':3},'end':{'line':0,'column':5}}
function! Scenario(name) abort
  call oax#request('selection.explain',{'observation':g:snapshot,'objective':a:name})
  call Wait('oax#inspect().pending == 0 || !oax#inspect().connected')
endfunction
call prop_type_add('unrelated',{'highlight':'ErrorMsg'})
call prop_add(1,1,{'type':'unrelated','length':1})
call Scenario('valid')
let marks=prop_list(1,{'types':['oax-agent']})
call assert_equal(1,len(marks))
call assert_equal(4,marks[0].col)
call assert_equal(4,marks[0].length)
call assert_equal(g:before,getpos('.'))
call assert_equal(g:original,getline(1,'$'))
call assert_false(&modified)
for invalid in ['hash','missing','version','outside','hidden']
  call Scenario(invalid)
  call assert_true(empty(oax#inspect().markedBuffers),invalid)
endfor
let g:snapshot.selection.end.column=4
call Scenario('half-surrogate')
call assert_true(empty(oax#inspect().markedBuffers))
let g:snapshot.selection.end.column=999
call Scenario('out-of-range')
call assert_true(empty(oax#inspect().markedBuffers))
let g:snapshot.selection.end.column=5
let g:snapshot.selection.end={'line':1,'column':6}
call Scenario('multiline')
call assert_equal(2,len(prop_list(1,{'types':['oax-agent'],'end_lnum':2})))
let g:snapshot.selection.end={'line':2,'column':0}
call Scenario('end-exclusive-eof')
call assert_equal(2,len(prop_list(1,{'types':['oax-agent'],'end_lnum':2})))
let g:snapshot.selection.end={'line':0,'column':5}
let g:oax_agent_cursor=0
call Scenario('opt-out')
call assert_true(empty(oax#inspect().markedBuffers))
let g:oax_agent_cursor=1
for terminal in ['completed','failed','cancelled']
  call Scenario('valid')
  call assert_false(empty(oax#inspect().markedBuffers))
  call Scenario(terminal)
  call assert_true(empty(oax#inspect().markedBuffers))
  call Scenario('late')
  call assert_true(empty(oax#inspect().markedBuffers),'Late terminal event restored highlight')
endfor
call Scenario('valid')
call assert_equal(1,len(prop_list(1,{'types':['unrelated']})))
call setline(1,'// changed')
doautocmd TextChanged
call assert_true(empty(oax#inspect().markedBuffers))
call Scenario('stale-source')
call assert_true(empty(oax#inspect().markedBuffers))
call setline(1,g:original[0])
call prop_add(1,1,{'type':'unrelated','length':1})
let g:snapshot.documentVersion=b:changedtick
call Scenario('valid')
call assert_false(empty(oax#inspect().markedBuffers))
split
call Scenario('valid')
close
call assert_true(empty(oax#inspect().markedBuffers))
call Scenario('valid')
call oax#close()
call assert_true(empty(prop_list(1,{'types':['oax-agent']})))
call assert_equal(1,len(prop_list(1,{'types':['unrelated']})))
call oax#connect($OAX_TEST_ROOT,$OAX_TEST_REPO . '/tests/vim/delayed-bridge.mjs',$OAX_TEST_NODE)
call Wait('oax#inspect().connected')
call setline(1,'// e' . nr2char(0x301) . ' marker')
call cursor(1,strlen('// e' . nr2char(0x301) . ' ') + 1)
call assert_equal(6,oax#capture().cursor.column)
let g:snapshot=oax#capture()
let g:snapshot.selection={'start':{'line':0,'column':3},'end':{'line':0,'column':5}}
call Scenario('valid')
call assert_false(empty(oax#inspect().markedBuffers))
let marks=prop_list(1,{'types':['oax-agent']})
call assert_equal(4,marks[0].col)
call assert_equal(3,marks[0].length)
call Scenario('scope')
call assert_false(oax#inspect().connected)
call assert_true(empty(prop_list(1,{'types':['oax-agent']})))
call assert_match('scope/order',oax#inspect().error)
call assert_equal('',v:errmsg)
call writefile([json_encode({'errors':v:errors,'passed':empty(v:errors)})],$OAX_TEST_RESULT)
if !empty(v:errors) | cquit | endif
qa!
