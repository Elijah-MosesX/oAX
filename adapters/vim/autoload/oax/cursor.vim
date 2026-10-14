let s:buffers = []
function! oax#cursor#clear() abort
  for buffer in s:buffers
    if bufloaded(buffer)
      call prop_remove({'bufnr': buffer, 'type': 'oax-agent', 'all': 1}, 1, len(getbufline(buffer, 1, '$')))
    endif
  endfor
  let s:buffers = []
endfunction
function! oax#cursor#buffers() abort
  return copy(s:buffers)
endfunction
function! s:byte(line, column) abort
  if type(a:column) != v:t_number || a:column < 0 | return -1 | endif
  let bytes = byteidxcomp(a:line, a:column, v:true)
  return bytes >= 0 && strutf16len(strpart(a:line, 0, bytes), v:true) == a:column ? bytes : -1
endfunction
function! oax#cursor#show(root, location) abort
  call oax#cursor#clear()
  let location = a:location
  if !has('textprop') || !get(g:, 'oax_agent_cursor', 1) | return | endif
  if get(location, 'contentHash', '') !~# '^[a-f0-9]\{64}$' | return | endif
  let path = get(location, 'path', '')
  if type(path) != v:t_string || empty(path) || path =~# '^[/\\]' || path =~# ':' | return | endif
  for part in split(path, '[/\\]')
    if part ==# '.' || part ==# '..' | return | endif
  endfor
  if index(['investigating','reviewing','editing'], get(location, 'mode', '')) < 0 | return | endif
  let range = get(location, 'range', {})
  let first = get(range, 'start', {})
  let last = get(range, 'end', {})
  if type(get(first, 'line', -1)) != v:t_number || type(get(last, 'line', -1)) != v:t_number
        \ || get(first, 'line', -1) < 0 || get(last, 'line', -1) < first.line | return | endif
  let target = a:root . '/' . substitute(path, '\\', '/', 'g')
  for window in getwininfo()
    let buffer = window.bufnr
    let file = substitute(fnamemodify(resolve(bufname(buffer)), ':p'), '\\', '/', 'g')
    let matches = has('win32') ? tolower(file) ==# tolower(target) : file ==# target
    if !matches || index(s:buffers, buffer) >= 0 || getbufvar(buffer, '&buftype') !=# '' | continue | endif
    if has_key(location, 'documentVersion') && location.documentVersion != getbufvar(buffer, 'changedtick') | continue | endif
    let lines = getbufline(buffer, 1, '$')
    let text = join(lines, "\n") . (getbufvar(buffer, '&endofline') ? "\n" : '')
    if strlen(text) > 131072 || sha256(text) !=# location.contentHash | continue | endif
    let finish = last
    " A final newline permits an end-exclusive EOF position beyond the last text line.
    if last.line == len(lines) && get(last, 'column', -1) == 0 && getbufvar(buffer, '&endofline')
      let finish = {'line': len(lines) - 1, 'column': strutf16len(lines[-1], v:true)}
    endif
    if first.line >= len(lines) || finish.line >= len(lines) | continue | endif
    let start = s:byte(lines[first.line], get(first, 'column', -1))
    let end = s:byte(lines[finish.line], get(finish, 'column', -1))
    if start < 0 || end < 0 || (first.line == finish.line && end <= start) | continue | endif
    if empty(prop_type_get('oax-agent')) | call prop_type_add('oax-agent', {'highlight': 'Search', 'combine': 1}) | endif
    call prop_add(first.line + 1, start + 1, {'bufnr': buffer, 'type': 'oax-agent',
          \ 'end_lnum': finish.line + 1, 'end_col': end + 1})
    call add(s:buffers, buffer)
  endfor
endfunction
