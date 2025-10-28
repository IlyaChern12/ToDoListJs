document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'todo_tasks_v1'

  function el(tag, opts = {}) {
    const e = document.createElement(tag)
    if (opts.className) e.className = opts.className
    if (opts.text) e.textContent = opts.text
    if (opts.attrs) Object.entries(opts.attrs).forEach(([k,v]) => e.setAttribute(k,v))
    return e
  }

  // основной контейнер
  const app = el('div', {className:'app'})
  document.body.appendChild(app)

  // стили
  const link = el('link', {attrs:{rel:'stylesheet', href:'css/styles.css'}})
  document.head.appendChild(link)

  // отрисовка
  function txt(v){ return document.createTextNode(v) }

  function formatDate(s){
    if(!s) return 'Без даты'
    const d = new Date(s)
    if(Number.isNaN(d.getTime())) return s
    return d.toLocaleDateString('ru-RU', {year:'numeric', month:'short', day:'numeric'})
  }

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8) }

let tasks = []
let sortAsc = true
let filterMode = 'all'
let searchQuery = ''
let manualOrder = false

  // сохранение в json
  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)) } catch(e){ console.warn('Saving failed', e) } }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY)
      if(!raw) return
      const parsed = JSON.parse(raw)
      if(Array.isArray(parsed)) tasks = parsed
    } catch(e){ tasks = [] }
  }

  // шапка
  const header = el('div', {className:'header'})
  const brand = el('div', {className:'brand'})
  const logo = el('div', {className:'logo', text:'TD'})
  const title = el('div', {className:'h1', text:'ToDo List'})
  brand.appendChild(logo); brand.appendChild(title)
  header.appendChild(brand)

  // добавление задач
  const formCard = el('div', {className:'card'})
  const form = el('form', {className:'form'})
  form.setAttribute('autocomplete','off')
  const inputTitle = el('input', {className:'input', attrs:{type:'text', name:'title', placeholder:'Название задачи', required:''}})
  const inputDate = el('input', {className:'input', attrs:{type:'date', name:'date'}})
  const btnAdd = el('button', {className:'btn', text:'Добавить'})
  form.appendChild(inputTitle); form.appendChild(inputDate); form.appendChild(btnAdd)
  formCard.appendChild(form)

  // основная часть
  const listCard = el('div', {className:'card'})
  const toolbar = el('div', {className:'toolbar'})
  const searchInput = el('input', {className:'input search', attrs:{type:'search', placeholder:'Поиск по названию'}})
  const filterSelect = el('select', {className:'input'})
  ;['all','active','done'].forEach(opt => {
    const o = el('option', {text: opt === 'all' ? 'Все' : opt === 'active' ? 'Невыполненные' : 'Выполненные'})
    o.value = opt
    filterSelect.appendChild(o)
  })
  const btnSort = el('button', {className:'btn secondary', text:'Сортировать по дате'})
  const btnClearCompleted = el('button', {className:'btn secondary', text:'Очистить выполненные'})
  toolbar.appendChild(searchInput); toolbar.appendChild(filterSelect); toolbar.appendChild(btnSort); toolbar.appendChild(btnClearCompleted)

  const counter = el('div', {className:'counter', text:'0 задач'});
  counter.style.textAlign = 'right';
  const list = el('div', {className:'list', attrs:{id:'tasks-list'}})
  const empty = el('div', {className:'empty', text:'Задач нет. Добавьте первую задачу!'})
  listCard.appendChild(toolbar);
  listCard.appendChild(counter);
  listCard.appendChild(list);
  listCard.appendChild(empty);

  // инфа в подвале
  const footer = el('div', {className:'footer'})
  const exportBtn = el('button', {className:'btn-export', text:'Экспорт JSON'})
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  const importBtn = el('input', {className:'input', attrs:{type:'file', accept:'.json'}})
  importBtn.title = 'Импорт JSON-файла'
  importBtn.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed)) {
          tasks = parsed.map(t => ({ id: t.id || uid(), title: String(t.title||''), date: t.date||'', done: !!t.done }));
          save();
          renderList();
          location.reload();
        } else {
          alert('Неправильный формат файла');
        }
      } catch (err) {
        alert('Ошибка при чтении файла');
      }
    };
    reader.readAsText(file);
    importBtn.value = '';
  });
  const importExportContainer = el('div', {className:'import-export'});
  importExportContainer.appendChild(exportBtn);
  importExportContainer.appendChild(importBtn);
  footer.appendChild(importExportContainer);

  app.appendChild(header); app.appendChild(formCard); app.appendChild(listCard); app.appendChild(footer)

  // логика добавления и изменения задач
  form.addEventListener('submit', e => { e.preventDefault(); handleAdd() })
  searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim().toLowerCase(); renderList() })
  filterSelect.addEventListener('change', () => { filterMode = filterSelect.value; renderList() })
  btnSort.addEventListener('click', e => { 
    e.preventDefault(); 
    manualOrder = false; 
    sortAsc = !sortAsc; 
    renderList(); 
    setTimeout(() => { manualOrder = true }, 200); 
  })

  // модальное окно для подтверждения удаления
  const modalOverlay = el('div', {className:'modal-overlay'});
  const modal = el('div', {className:'modal'});
  const modalText = el('div', {className:'modal-text', text:'Удалить все выполненные задачи?'});
  const modalBtns = el('div', {className:'modal-buttons'});
  const modalYes = el('button', {className:'btn', text:'Да'});
  const modalNo = el('button', {className:'btn secondary', text:'Нет'});
  modalBtns.appendChild(modalYes); modalBtns.appendChild(modalNo);
  modal.appendChild(modalText); modal.appendChild(modalBtns);
  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);
  modalOverlay.style.display = 'none';

  btnClearCompleted.addEventListener('click', e => {
    e.preventDefault();
    modalOverlay.style.display = 'flex';
  });

  modalNo.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
  });

  modalYes.addEventListener('click', () => {
    tasks = tasks.filter(t => !t.done);
    save();
    renderList();
    modalOverlay.style.display = 'none';
  });

  function handleAdd(){
    const title = inputTitle.value.trim()
    const date = inputDate.value || ''
    if(!title) return inputTitle.focus()
    tasks.push({id: uid(), title, date, done:false})
    save(); renderList(); form.reset(); inputTitle.focus()
  }

  function clearCompleted(){
    if(!confirm('Удалить все выполненные задачи?')) return
    tasks = tasks.filter(t => !t.done)
    save(); renderList()
  }

  function removeTask(id){ tasks = tasks.filter(t => t.id !== id); save(); renderList() }
  function toggleDone(id){ const t = tasks.find(x => x.id === id); if(!t) return; t.done = !t.done; save(); renderList() }

  function startEdit(id){
    const t = tasks.find(x => x.id === id); if(!t) return
    const item = list.querySelector(`[data-id="${id}"]`)
    if(!item) return
    const titleWrap = item.querySelector('.task-title')
    titleWrap.classList.add('editing') // класс для редактирования
    while(titleWrap.firstChild) titleWrap.removeChild(titleWrap.firstChild)

    const inTitle = el('input', {className:'input', attrs:{type:'text'}})
    inTitle.value = t.title
    const inDate = el('input', {className:'input', attrs:{type:'date'}})
    inDate.value = t.date || ''
    const saveBtn = el('button', {className:'btn edit-save', text:'Сохранить'})
    const cancelBtn = el('button', {className:'btn secondary edit-cancel', text:'Отмена'})

    titleWrap.appendChild(inTitle); titleWrap.appendChild(inDate); titleWrap.appendChild(saveBtn); titleWrap.appendChild(cancelBtn)

    saveBtn.addEventListener('click', e => {
      e.preventDefault()
      const newTitle = inTitle.value.trim()
      const newDate = inDate.value || ''
      if(!newTitle) { inTitle.focus(); return }
      t.title = newTitle
      t.date = newDate
      save(); renderList()
    })

    cancelBtn.addEventListener('click', e => { e.preventDefault(); renderList() })
  }

  let dragSrcId = null
  function attachDragHandlers(item){
    item.setAttribute('draggable', 'true')
    item.addEventListener('dragstart', e => {
      dragSrcId = item.getAttribute('data-id')
      e.dataTransfer.effectAllowed = 'move'
      try{ e.dataTransfer.setData('text/plain', dragSrcId) } catch(err){}
      item.classList.add('dragging')
    })
    item.addEventListener('dragend', () => { dragSrcId = null; item.classList.remove('dragging') })
    item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' })
    item.addEventListener('drop', e => {
      e.preventDefault()
      const dstId = item.getAttribute('data-id')
      const srcId = dragSrcId || (e.dataTransfer.getData('text/plain') || '')
      if(!srcId || srcId === dstId) return
      const srcIndex = tasks.findIndex(t => t.id === srcId)
      const dstIndex = tasks.findIndex(t => t.id === dstId)
      if(srcIndex < 0 || dstIndex < 0) return
      const [moved] = tasks.splice(srcIndex, 1)
      tasks.splice(dstIndex, 0, moved)
      manualOrder = true
      save(); renderList()
    })
  }

  // функция модального подтверждения
  function confirmModal(message) {
    return new Promise((resolve) => {
      const modalOverlay = el('div', {className: 'modal-overlay'})
      const modal = el('div', {className: 'modal'})
      const msg = el('div', {className: 'modal-message', text: message})
      const btnYes = el('button', {className: 'btn', text: 'Да'})
      const btnNo = el('button', {className: 'btn secondary', text: 'Нет'})

      modal.appendChild(msg)
      const buttons = el('div', {className: 'modal-buttons'})
      buttons.appendChild(btnYes)
      buttons.appendChild(btnNo)
      modal.appendChild(buttons)
      modalOverlay.appendChild(modal)
      document.body.appendChild(modalOverlay)

      function cleanup() {
        btnYes.removeEventListener('click', onYes)
        btnNo.removeEventListener('click', onNo)
        document.body.removeChild(modalOverlay)
      }

      function onYes() {
        cleanup()
        resolve(true)
      }

      function onNo() {
        cleanup()
        resolve(false)
      }

      btnYes.addEventListener('click', onYes)
      btnNo.addEventListener('click', onNo)
    })
  }

  // создание листа задач
  function renderList(){
    while(list.firstChild) list.removeChild(list.firstChild)

    let shown = tasks.filter(t => {
      if(filterMode === 'done') return t.done
      if(filterMode === 'active') return !t.done
      return true
    })
    if(searchQuery) shown = shown.filter(t => t.title.toLowerCase().includes(searchQuery))

    if (!manualOrder) {
      shown.sort((a,b) => {
        const ad = a.date || '9999-12-31'
        const bd = b.date || '9999-12-31'
        return ad === bd ? 0 : sortAsc ? (ad < bd ? -1 : 1) : (ad < bd ? 1 : -1)
      })
    }

    empty.style.display = shown.length === 0 ? 'block' : 'none'

    shown.forEach(t => {
      const item = el('div', {className:'task'}); item.setAttribute('data-id', t.id)
      const drag = el('div', {className:'drag-handle', text:'☰'}); drag.title='Перетащите для изменения порядка'
      const chk = el('div', {className:'checkbox'}); chk.tabIndex=0; chk.setAttribute('role','button')
      chk.addEventListener('click', () => toggleDone(t.id))
      chk.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggleDone(t.id) } })
      chk.textContent = t.done ? '✔' : ''
      const titleWrap = el('div',{className:'task-title'})
      const titleStrong = el('strong',{text:t.title})
      const meta = el('div',{className:'task-meta', text:t.date ? formatDate(t.date) : 'Без даты'})
      titleWrap.appendChild(titleStrong); titleWrap.appendChild(meta)
      const actions = el('div',{className:'task-actions'})
      const btnEdit = el('button',{className:'icon-btn', text:'✎'}); btnEdit.title='Редактировать'
      btnEdit.addEventListener('click', e=>{ e.preventDefault(); startEdit(t.id) })
      const btnDel = el('button',{className:'icon-btn', text:'🗑'}); btnDel.title='Удалить'
      btnDel.addEventListener('click', async e=>{
        e.preventDefault();
        const confirmed = await confirmModal('Удалить задачу?');
        if (confirmed) removeTask(t.id);
      })
      if(t.done) item.classList.add('done')
      item.appendChild(drag); item.appendChild(chk); item.appendChild(titleWrap); item.appendChild(actions)
      actions.appendChild(btnEdit); actions.appendChild(btnDel)
      attachDragHandlers(item)
      list.appendChild(item)
    })

    counter.textContent = `${tasks.length} задач`;
  }

  // инитка
  load(); renderList()

  window.todoApp = {
    addTask: (title,date)=>{ tasks.push({id:uid(),title,date:date||'',done:false}); save(); renderList() },
    getTasks: ()=>tasks.slice()
  }
  window.addEventListener('beforeunload', save)
})