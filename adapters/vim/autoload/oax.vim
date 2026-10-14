let s:state = {'serial': 0, 'events': [], 'pending': {}, 'generation': 0, 'observed': {}, 'observations': 0}
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
  return strutf16len(a:value, v:true)
endfunction
function! s:selection(point) abort
  let kind = mode()
  if kind ==# "\<C-V>" | throw 'Block selections are not supported by oAX' | endif
  if kind !=# 'v' && kind !=# 'V' | return {'start': a:point, 'end': a:point} | endif
  let bounds = getregionpos(getpos('v'), getpos('.'), {'type': kind, 'eol': v:true, 'bounds': v:true})[0]
  let first = bounds[0]
  let last = bounds[1]
  if first[3] != 0 || last[3] != 0 | throw 'Virtual selections are not supported by oAX' | endif
  let start = {'line': first[1] - 1, 'column': s:utf16(strpart(getline(first[1]), 0, first[2] - 1))}
  let tail = getline(last[1])
  let bytes = last[2] - 1
  let finish = {'line': last[1] - 1, 'column': s:utf16(strpart(tail, 0, bytes) . strcharpart(strpart(tail, bytes), 0, 1, v:true))}
  if (kind ==# 'V' || bytes >= strlen(tail)) && (last[1] < line('$') || &endofline)
    let finish = {'line': last[1], 'column': 0}
  endif
  return {'start': start, 'end': finish}
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
  " Ex mode/timer callbacks can report an unavailable or not-yet-redrawn viewport.
  let first = line('w0')
  let last = line('w$')
  let visible = first > 0 && last >= first && last <= line('$')
        \ ? [{'start': {'line': first - 1, 'column': 0}, 'end': {'line': last - 1, 'column': s:utf16(getline(last))}}] : []
  let tabs = []
  for window in getwininfo()
    let name = substitute(fnamemodify(bufname(window.bufnr), ':p'), '\\', '/', 'g')
    if stridx(tolower(name), tolower(prefix)) == 0 && getbufvar(window.bufnr, '&buftype') ==# ''
      call add(tabs, strpart(name, strlen(prefix)))
    endif
  endfor
  return {'path': strpart(file, strlen(prefix)), 'uri': s:uri(file), 'text': text,
        \ 'documentVersion': b:changedtick, 'dirty': &modified ? v:true : v:false, 'cursor': point,
        \ 'selection': s:selection(point), 'openFiles': tabs,
        \ 'visibleRanges': visible}
endfunction
function! s:snapshot() abort
  if &buftype !=# '' | return {} | endif
  try
    let snapshot = oax#capture()
    if strlen(json_encode({'observation': snapshot})) > 240000 | return {} | endif
    return snapshot
  catch
    return {}
  endtry
endfunction
function! oax#observe(...) abort
  if a:0 && a:1
    call oax#cursor#clear()
    let s:state.observed = {}
    let s:state.stamp = ''
  endif
  if has_key(s:state, 'timer') | call timer_stop(s:state.timer) | call remove(s:state, 'timer') | endif
  if !has_key(s:state, 'session') || !get(g:, 'oax_observe', 1) | return | endif
  let s:state.timer = timer_start(250, function('s:observe', [s:state.generation]))
endfunction
function! s:observe(generation, timer) abort
  if a:generation != s:state.generation || a:timer != get(s:state, 'timer', -1) || !has_key(s:state, 'session') || !get(g:, 'oax_observe', 1) | return | endif
  if !empty(s:state.pending) || !empty(get(s:state, 'task', '')) | call oax#observe() | return | endif
  let snapshot = s:snapshot()
  if empty(snapshot) | let s:state.observed = {} | let s:state.stamp = '' | return | endif
  let stamp = sha256(json_encode(snapshot))
  if stamp ==# get(s:state, 'stamp', '') | return | endif
  let s:state.observed = {}
  let s:state.stamp = ''
  call s:send('spatial.observe', {'observation': snapshot}, {'background': 1, 'stamp': stamp,
        \ 'path': snapshot.path, 'version': snapshot.documentVersion, 'hash': sha256(snapshot.text)})
endfunction
function! s:observed(request, message) abort
  let current = s:snapshot()
  if empty(current) || sha256(json_encode(current)) !=# a:request.stamp | call oax#observe() | return | endif
  if !a:message.ok
    let s:state.observationError = a:message.error.code
    if index(['BUSY', 'TASK_BUSY'], a:message.error.code) >= 0 | call oax#observe() | endif
    return
  endif
  let payload = a:message.payload
  if payload.documentVersion != a:request.version | return | endif
  let focused = get(payload, 'focused', {})
  if !empty(focused) && (focused.path !=# a:request.path || focused.hash !=# a:request.hash) | return | endif
  let s:state.stamp = a:request.stamp
  let s:state.observationError = ''
  let s:state.observed = {'path': a:request.path, 'documentVersion': a:request.version, 'focused': focused}
  let s:state.observations += 1
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
      call oax#observe()
      return
    endif
    if message.workspaceId !=# get(s:state, 'workspace', '') | throw 'oAX workspace mismatch' | endif
    if message.type ==# 'event'
      if message.sessionId !=# s:state.session || message.sequence <= get(s:state, 'sequence', 0) | throw 'oAX event scope/order mismatch' | endif
      let s:state.sequence = message.sequence
      if message.method ==# 'task.state'
        let s:state.task = index(['completed', 'failed', 'cancelled'], message.payload.state) < 0 ? message.taskId : ''
        if message.payload.state ==# 'created' || empty(s:state.task) | call oax#cursor#clear() | endif
      elseif message.method ==# 'agent.cursor.changed' && message.taskId ==# get(s:state, 'task', '')
        call oax#cursor#show(s:state.root, message.payload)
      endif
      call add(s:state.events, message)
      if len(s:state.events) > 100 | call remove(s:state.events, 0) | endif
      if exists('#User#OaxEvent') | doautocmd <nomodeline> User OaxEvent | endif
    elseif message.type ==# 'response' && has_key(s:state.pending, message.correlationId)
      let pending = remove(s:state.pending, message.correlationId)
      if get(pending, 'background', 0)
        call s:observed(pending, message)
      else
        let s:state.result = message
        if !get(g:, 'oax_acceptance', 0)
          call popup_create(split(json_encode(message), "\n"), {'title': 'oAX evidence', 'maxwidth': 90, 'maxheight': 20, 'border': [], 'close': 'click'})
        endif
      endif
      if empty(s:state.pending) && has_key(s:state, 'waiting')
        let waiting = remove(s:state, 'waiting')
        call oax#request(waiting.method, waiting.payload)
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
  let s:state.error = ''
  let s:state.observationError = ''
  let s:state.observations = 0
  let s:state.root = substitute(substitute(fnamemodify(resolve(a:root), ':p'), '\\', '/', 'g'), '/$', '', '')
  let s:state.job = job_start([a:node, a:cli, 'editor-bridge', s:state.root], {'out_mode': 'nl', 'out_cb': function('s:receive', [s:state.generation]), 'exit_cb': function('s:exit', [s:state.generation]), 'err_io': 'null'})
  if job_status(s:state.job) !=# 'run' | call oax#close() | throw 'oAX bridge failed to start' | endif
endfunction
function! oax#request(method, payload) abort
  if !has_key(s:state, 'session') | throw 'Wait for oAX connection' | endif
  if index(['spatial.observe', 'graph.query', 'context.preview', 'index.status', 'repository.onboard', 'history.query', 'selection.explain', 'task.cancel'], a:method) < 0 | throw 'Unsupported read-only method' | endif
  if !empty(s:state.pending) && a:method !=# 'task.cancel'
    if !empty(filter(copy(s:state.pending), 'get(v:val, "background", 0)')) && !has_key(s:state, 'waiting')
      let s:state.waiting = {'method': a:method, 'payload': deepcopy(a:payload)}
      return
    endif
    throw 'Wait for the active oAX request'
  endif
  call s:send(a:method, a:payload, {})
endfunction
function! s:send(method, payload, metadata) abort
  let s:state.serial += 1
  let id = 'vim-' . s:state.serial
  let s:state.pending[id] = a:metadata
  let message = {'type': 'request', 'version': '0.1', 'id': id, 'timestamp': s:timestamp(), 'workspaceId': s:state.workspace, 'sessionId': s:state.session, 'method': a:method, 'payload': a:payload}
  let encoded = json_encode(message)
  if strlen(encoded) > 262144 | call remove(s:state.pending, id) | throw 'oAX request exceeds limit' | endif
  call ch_sendraw(job_getchannel(s:state.job), encoded . "\n")
endfunction
function! oax#inspect() abort
  return deepcopy({'connected': has_key(s:state, 'session'), 'events': s:state.events, 'result': get(s:state, 'result', {}), 'error': get(s:state, 'error', ''), 'pending': len(s:state.pending),
        \ 'background': !empty(filter(copy(s:state.pending), 'get(v:val, "background", 0)')), 'queued': has_key(s:state, 'waiting'),
        \ 'markedBuffers': oax#cursor#buffers(), 'observed': s:state.observed, 'observations': s:state.observations, 'observationError': get(s:state, 'observationError', '')})
endfunction
function! oax#close() abort
  call oax#cursor#clear()
  let s:state.generation += 1
  if has_key(s:state, 'timer') | call timer_stop(s:state.timer) | call remove(s:state, 'timer') | endif
  if has_key(s:state, 'waiting') | call remove(s:state, 'waiting') | let s:state.error = 'DISCONNECTED: queued oAX request was not sent' | endif
  if has_key(s:state, 'job') | call job_stop(s:state.job) | call remove(s:state, 'job') | endif
  for key in ['session', 'workspace', 'sequence', 'result', 'stamp', 'task']
    if has_key(s:state, key) | call remove(s:state, key) | endif
  endfor
  let s:state.events = []
  let s:state.pending = {}
  let s:state.observed = {}
endfunction
