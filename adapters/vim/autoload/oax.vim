let s:state = {'serial': 0, 'events': [], 'pending': {}, 'generation': 0}
function! s:timestamp() abort
  " Vim's strftime has no UTC argument. Format epoch seconds without changing TZ.
  let seconds = localtime()
  let days = seconds / 86400
  let remainder = seconds % 86400
  let year = 1970
  while 1
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
    let length = 365 + leap
    if days < length | break | endif
    let days -= length
    let year += 1
  endwhile
  let months = [31, 28 + leap, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let month = 0
  while days >= months[month]
    let days -= months[month]
    let month += 1
  endwhile
  return printf('%04d-%02d-%02dT%02d:%02d:%02dZ', year, month + 1, days + 1, remainder / 3600, (remainder % 3600) / 60, remainder % 60)
endfunction
function! s:utf16(value) abort
  let utf16Units = 0
  for char in split(a:value, '\zs')
    let utf16Units += char2nr(char) > 65535 ? 2 : 1
  endfor
  return utf16Units
endfunction
function! s:uri(value) abort
  let encoded = ''
  for byte in range(0, strlen(a:value) - 1)
    let char = strpart(a:value, byte, 1)
    let encoded .= char =~# '[A-Za-z0-9/._~:-]' ? char : printf('%%%02X', char2nr(char))
  endfor
  return (a:value =~# '^/' ? 'file://' : 'file:///') . encoded
endfunction
function! oax#capture() abort
  if !has_key(s:state, 'root') | throw 'oAX is not configured' | endif
  let file = substitute(fnamemodify(resolve(expand('%:p')), ':p'), '\\', '/', 'g')
  let prefix = s:state.root . '/'
  if stridx(tolower(file), tolower(prefix)) != 0 | throw 'File outside configured workspace' | endif
  let lines = getline(1, '$')
  let text = join(lines, "\n") . (&endofline ? "\n" : '')
  if strlen(text) > 131072 | throw 'Selected buffer exceeds oAX budget' | endif
  let point = {'line': line('.') - 1, 'column': s:utf16(strpart(getline('.'), 0, col('.') - 1))}
  let tabs = []
  for window in getwininfo()
    let name = substitute(fnamemodify(bufname(window.bufnr), ':p'), '\\', '/', 'g')
    if stridx(tolower(name), tolower(prefix)) == 0 && getbufvar(window.bufnr, '&buftype') ==# ''
      call add(tabs, strpart(name, strlen(prefix)))
    endif
  endfor
  return {'path': strpart(file, strlen(prefix)), 'uri': s:uri(file), 'text': text,
        \ 'documentVersion': b:changedtick, 'dirty': &modified ? v:true : v:false, 'cursor': point,
        \ 'selection': {'start': point, 'end': point}, 'openFiles': tabs,
        \ 'visibleRanges': [{'start': {'line': line('w0') - 1, 'column': 0}, 'end': {'line': line('w$') - 1, 'column': s:utf16(getline(line('w$')))}}]}
endfunction
function! s:receive(generation, channel, line) abort
  if a:generation != s:state.generation | return | endif
  try
    if strlen(a:line) > 262144 | throw 'oAX frame exceeds limit' | endif
    let message = json_decode(a:line)
    if message.version !=# '0.1' | throw 'Unsupported oAX protocol' | endif
    if message.type ==# 'response' && message.correlationId ==# 'adapter-bootstrap'
      if !message.ok || message.payload.contract !=# 'editor-read-only.v1' || message.payload.engine !=# 'mock' | throw 'Invalid oAX bootstrap' | endif
      let s:state.workspace = message.payload.workspaceId
      let s:state.session = message.payload.sessionId
      return
    endif
    if message.workspaceId !=# get(s:state, 'workspace', '') | throw 'oAX workspace mismatch' | endif
    if message.type ==# 'event'
      if message.sessionId !=# s:state.session || message.sequence <= get(s:state, 'sequence', 0) | throw 'oAX event scope/order mismatch' | endif
      let s:state.sequence = message.sequence
      call add(s:state.events, message)
      if len(s:state.events) > 100 | call remove(s:state.events, 0) | endif
    elseif message.type ==# 'response' && has_key(s:state.pending, message.correlationId)
      call remove(s:state.pending, message.correlationId)
      let s:state.result = message
      if !get(g:, 'oax_acceptance', 0)
        call popup_create(split(json_encode(message), "\n"), {'title': 'oAX evidence', 'maxwidth': 90, 'maxheight': 20, 'border': [], 'close': 'click'})
      endif
    else
      throw 'Uncorrelated oAX response'
    endif
  catch
    let s:state.error = v:exception
    call oax#close()
  endtry
endfunction
function! s:exit(generation, job, status) abort
  if a:generation != s:state.generation | return | endif
  call oax#close()
endfunction
function! oax#connect(root, cli, node) abort
  if has_key(s:state, 'job') | throw 'Close the existing oAX connection first' | endif
  if !executable(a:node) || !filereadable(a:cli) || !isdirectory(a:root) | throw 'Configure valid trusted workspace, CLI and Node paths' | endif
  let s:state.generation += 1
  let s:state.root = substitute(substitute(fnamemodify(resolve(a:root), ':p'), '\\', '/', 'g'), '/$', '', '')
  let s:state.job = job_start([a:node, a:cli, 'editor-bridge', s:state.root], {'out_mode': 'nl', 'out_cb': function('s:receive', [s:state.generation]), 'exit_cb': function('s:exit', [s:state.generation]), 'err_io': 'null'})
  if job_status(s:state.job) !=# 'run' | call oax#close() | throw 'oAX bridge failed to start' | endif
endfunction
function! oax#request(method, payload) abort
  if !has_key(s:state, 'session') | throw 'Wait for oAX connection' | endif
  if index(['spatial.observe', 'graph.query', 'context.preview', 'index.status', 'repository.onboard', 'history.query', 'selection.explain', 'task.cancel'], a:method) < 0 | throw 'Unsupported read-only method' | endif
  if !empty(s:state.pending) | throw 'Wait for the active oAX request' | endif
  let s:state.serial += 1
  let id = 'vim-' . s:state.serial
  let s:state.pending[id] = 1
  let message = {'type': 'request', 'version': '0.1', 'id': id, 'timestamp': s:timestamp(), 'workspaceId': s:state.workspace, 'sessionId': s:state.session, 'method': a:method, 'payload': a:payload}
  let encoded = json_encode(message)
  if strlen(encoded) > 262144 | call remove(s:state.pending, id) | throw 'oAX request exceeds limit' | endif
  call ch_sendraw(job_getchannel(s:state.job), encoded . "\n")
endfunction
function! oax#inspect() abort
  return deepcopy({'connected': has_key(s:state, 'session'), 'events': s:state.events, 'result': get(s:state, 'result', {}), 'error': get(s:state, 'error', ''), 'pending': len(s:state.pending)})
endfunction
function! oax#close() abort
  let s:state.generation += 1
  if has_key(s:state, 'job') | call job_stop(s:state.job) | call remove(s:state, 'job') | endif
  for key in ['session', 'workspace', 'sequence', 'result']
    if has_key(s:state, key) | call remove(s:state, key) | endif
  endfor
  let s:state.events = []
  let s:state.pending = {}
endfunction
