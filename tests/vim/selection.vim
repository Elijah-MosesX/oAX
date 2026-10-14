" Sourced by the default actual-editor acceptance while connected.
let g:selection_original=getline(1,'$')
call setline(1, ['// 😀 e' . nr2char(0x301) . ' end', 'second', 'third'])
function! CheckSelection(keys, expected) abort
  let g:selection_expected=a:expected
  execute "normal! \<Esc>gg0" . a:keys . "\<Cmd>call AssertSelection()\<CR>\<Esc>"
endfunction
function! AssertSelection() abort
  let before=getpos('.')
  let anchor=getpos('v')
  let kind=mode()
  let source=getline(1,'$')
  let version=b:changedtick
  call assert_equal(g:selection_expected, oax#capture().selection)
  call assert_equal(before,getpos('.'))
  call assert_equal(anchor,getpos('v'))
  call assert_equal(kind,mode())
  call assert_equal(source,getline(1,'$'))
  call assert_equal(version,b:changedtick)
  execute "normal! \<Esc>"
endfunction
set selection=inclusive
call CheckSelection('3lv', {'start':{'line':0,'column':3},'end':{'line':0,'column':5}})
call CheckSelection('3lvl', {'start':{'line':0,'column':3},'end':{'line':0,'column':6}})
call CheckSelection('4lvh', {'start':{'line':0,'column':3},'end':{'line':0,'column':6}})
call CheckSelection('5lv', {'start':{'line':0,'column':6},'end':{'line':0,'column':8}})
call CheckSelection('3lvj0', {'start':{'line':0,'column':3},'end':{'line':1,'column':1}})
call CheckSelection('Vj', {'start':{'line':0,'column':0},'end':{'line':2,'column':0}})
call CheckSelection('jVk', {'start':{'line':0,'column':0},'end':{'line':2,'column':0}})
call CheckSelection('GV', {'start':{'line':2,'column':0},'end':{'line':3,'column':0}})
set noendofline
call CheckSelection('GV', {'start':{'line':2,'column':0},'end':{'line':2,'column':5}})
set endofline selection=exclusive
call CheckSelection('3lvl', {'start':{'line':0,'column':3},'end':{'line':0,'column':5}})
call CheckSelection('4lvh', {'start':{'line':0,'column':3},'end':{'line':0,'column':5}})
call CheckSelection('3lv', {'start':{'line':0,'column':3},'end':{'line':0,'column':5}})
set selection=inclusive
function! AssertBlock() abort
  try
    call oax#capture()
    call assert_report('Block selection was accepted')
  catch /Block selections are not supported/
  endtry
endfunction
execute "normal! gg0\<C-V>j\<Cmd>call AssertBlock()\<CR>\<Esc>"
function! AssertVirtual() abort
  try
    call oax#capture()
    call assert_report('Virtual selection was accepted')
  catch /Virtual selections are not supported/
  endtry
endfunction
set virtualedit=all
execute "normal! gg$3lv\<Cmd>call AssertVirtual()\<CR>\<Esc>"
set virtualedit=
" The public mapping captures before Visual mode exits and reaches the real bridge.
let g:selection_previous=oax#inspect().result.correlationId
call feedkeys("gg03lv\<Plug>(OaxObserve)", 'xt')
let g:selection_deadline=reltime()
while (oax#inspect().pending > 0 || oax#inspect().queued) && reltimefloat(reltime(g:selection_deadline)) < 10
  sleep 10m
endwhile
call assert_true(oax#inspect().result.ok)
call assert_notequal(g:selection_previous,oax#inspect().result.correlationId)
call assert_equal('',oax#inspect().error)
execute "normal! \<Esc>"
call assert_equal(oax#capture().cursor,oax#capture().selection.start)
call assert_equal(oax#capture().cursor,oax#capture().selection.end)
silent %delete _
call setline(1,g:selection_original)
call cursor(2,17)
