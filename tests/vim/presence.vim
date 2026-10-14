set encoding=utf-8
set nomore
set hidden
let g:oax_acceptance=1
execute 'set runtimepath^=' . fnameescape($OAX_TEST_REPO . '/adapters/vim')
runtime plugin/oax.vim
execute 'edit ' . fnameescape($OAX_TEST_ROOT . '/sample.ts')
let source=bufnr('%')
call setline(2, 'export function add(a: number, b: number) { return a+b+1; }')
call cursor(2, 17)
let before=getpos('.')
function! Wait(expression) abort
  let deadline=reltime()
  while !eval(a:expression) && reltimefloat(reltime(deadline)) < 10
    sleep 5m
  endwhile
  if !eval(a:expression)
    call assert_report(a:expression . ': ' . json_encode(oax#inspect()) . ' capture: ' . json_encode(oax#capture()))
    call writefile([json_encode({'errors':v:errors,'passed':0})],$OAX_TEST_RESULT)
    cquit
  endif
endfunction
call oax#connect($OAX_TEST_ROOT, $OAX_TEST_CLI, $OAX_TEST_NODE)
call Wait('!empty(oax#inspect().observed)')
call assert_equal('add', oax#inspect().observed.focused.name)
call assert_equal(b:changedtick, oax#inspect().observed.documentVersion)
call assert_equal(before,getpos('.'))
call assert_true(empty(oax#inspect().events))
call assert_true(empty(oax#inspect().result))
let g:observationsBefore=oax#inspect().observations
for i in range(20)
  call cursor(1, strlen('// 😀 ') + 1)
  doautocmd CursorMoved
endfor
call Wait('oax#inspect().observations > g:observationsBefore')
call assert_equal(g:observationsBefore+1,oax#inspect().observations)
call assert_equal(6,oax#capture().cursor.column)
doautocmd CursorMoved
sleep 350m
call assert_equal(g:observationsBefore+1,oax#inspect().observations)
call setline(2,'export function changed() { return 3; }')
call cursor(2,18)
doautocmd TextChanged
call assert_true(empty(oax#inspect().observed))
call Wait('!empty(oax#inspect().observed)')
call assert_equal('changed',oax#inspect().observed.focused.name)
enew
setlocal buftype=nofile
doautocmd BufEnter
sleep 350m
call assert_true(empty(oax#inspect().observed))
execute 'buffer ' . source
call oax#close()
call assert_true(empty(oax#inspect().observed))
let g:oax_observe=0
call oax#connect($OAX_TEST_ROOT,$OAX_TEST_CLI,$OAX_TEST_NODE)
call Wait('oax#inspect().connected')
doautocmd CursorMoved
sleep 350m
call assert_equal(0,oax#inspect().observations)
call oax#close()

" A delayed private fixture makes stale and queued responses deterministic.
let g:oax_observe=1
call oax#connect($OAX_TEST_ROOT,$OAX_TEST_REPO . '/tests/vim/delayed-bridge.mjs',$OAX_TEST_NODE)
call Wait('oax#inspect().background')
call cursor(1,1)
call oax#request('graph.query',{'observation':oax#capture(),'relationship':'callers'})
call assert_true(oax#inspect().queued)
call oax#request('task.cancel',{'taskId':'missing'})
call Wait('!oax#inspect().queued && oax#inspect().pending == 0')
call assert_equal('graph.query',oax#inspect().result.payload.method)
call assert_true(empty(oax#inspect().observed),'Old cursor reply was accepted')
call Wait('!empty(oax#inspect().observed)')
let g:observationsBefore=oax#inspect().observations
call cursor(2,3)
doautocmd CursorMoved
call Wait('oax#inspect().background')
execute 'hide edit ' . fnameescape($OAX_TEST_ROOT . '/consumer.ts')
call Wait('!oax#inspect().background')
call assert_equal(g:observationsBefore,oax#inspect().observations,'Old buffer reply was accepted')
call Wait('!empty(oax#inspect().observed)')
call assert_equal('consumer.ts',oax#inspect().observed.path)
let g:observationsBefore=oax#inspect().observations
for invalid in ['wrong-hash.ts','wrong-path.ts','wrong-version.ts']
  execute 'hide edit ' . fnameescape($OAX_TEST_ROOT . '/' . invalid)
  call setline(1,'export const sample=1;')
  doautocmd TextChanged
  call Wait('oax#inspect().background')
  call Wait('!oax#inspect().background')
  call assert_true(empty(oax#inspect().observed),'Mismatched evidence accepted: ' . invalid)
endfor
call assert_equal(g:observationsBefore,oax#inspect().observations)
execute 'hide edit ' . fnameescape($OAX_TEST_ROOT . '/../outside.ts')
doautocmd BufEnter
sleep 350m
call assert_true(empty(oax#inspect().observed))
call assert_false(oax#inspect().background)
call assert_equal(g:observationsBefore,oax#inspect().observations)
execute 'hide edit ' . fnameescape($OAX_TEST_ROOT . '/oversized.ts')
call setline(1,repeat('x',131073))
doautocmd TextChanged
sleep 350m
call assert_false(oax#inspect().background)
call assert_true(empty(oax#inspect().observed))
execute 'hide edit ' . fnameescape($OAX_TEST_ROOT . '/consumer.ts')
call Wait('!empty(oax#inspect().observed)')
call cursor(2,4)
doautocmd CursorMoved
call Wait('oax#inspect().background')
call oax#request('graph.query',{'observation':oax#capture(),'relationship':'callers'})
call oax#close()
sleep 400m
call assert_false(oax#inspect().connected)
call assert_false(oax#inspect().queued)
call assert_equal(0,oax#inspect().pending)
call assert_true(empty(oax#inspect().observed))
call assert_match('DISCONNECTED',oax#inspect().error)
call oax#connect($OAX_TEST_ROOT,$OAX_TEST_CLI,$OAX_TEST_NODE)
call Wait('!empty(oax#inspect().observed)')
call assert_equal('',oax#inspect().error)
call assert_notequal('fixture',oax#inspect().observed.focused.name)
call oax#close()
call assert_equal('',v:errmsg)
call writefile([json_encode({'errors':v:errors,'passed':empty(v:errors),'vimError':v:errmsg})],$OAX_TEST_RESULT)
if !empty(v:errors) | cquit | endif
qa!
