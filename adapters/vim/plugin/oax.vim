if exists('g:loaded_oax') | finish | endif
let g:loaded_oax = 1
command! OaxConnect call oax#connect(g:oax_root, g:oax_cli, get(g:, 'oax_node', 'node'))
command! OaxClose call oax#close()
command! OaxObserve call oax#request('spatial.observe', {'observation': oax#capture()})
command! OaxCallers call oax#request('graph.query', {'observation': oax#capture(), 'relationship': 'callers'})
command! OaxContext call oax#request('context.preview', {'observation': oax#capture(), 'objective': 'Explain current symbol and its direct callers'})
augroup oax_cleanup
  autocmd!
  autocmd VimLeavePre * call oax#close()
augroup END
