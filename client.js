window.__ModuleLoader__.load({
  id: 'dsh-fold-answers',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const STYLE_ID = 'dsh-fold-answers-style'
    // Answers render as the keyed 'assistant-step' node; process members carry
    // data-turn-process-member and are handled by the Turn fold instead.
    const ROW = '[data-chat-flow-kind="assistant-step"]'
    const PROCESS = '[data-chat-flow-kind="turn-process"]'
    // The turn tail hosts the feature cards (deliverables / changed files) and
    // the action strip we inject into.
    const TAIL = '[data-turn-tail]'
    const ACTION = '[data-dsh-fold-action]'
    const STUB = 'data-dsh-fold-stub'
    const HIDDEN = 'data-dsh-tail-hidden'
    const EVENT = 'dsh-fold-answers:change'
    const PREFIX = 'dsh-fold-answers:'

    const CSS = `
${ROW} { position: relative; }
${ROW}[data-dsh-fold="1"] > *:not([${STUB}]) { display: none !important; }
[${STUB}] {
  display: inline-flex; align-items: center; gap: 0.4rem;
  max-width: 100%; box-sizing: border-box;
  padding: 0.15rem 0.5rem; margin: 0.1rem 0;
  border: 1px dashed rgba(128,128,128,0.45); border-radius: 0.4rem;
  font-size: 0.78rem; line-height: 1.5; opacity: 0.75;
  cursor: pointer; user-select: none;
  overflow: hidden; white-space: nowrap;
}
[${STUB}]:hover { opacity: 1; border-style: solid; }
[${STUB}] > b { font-weight: 600; flex: none; }
[${STUB}] > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[${HIDDEN}] { display: none !important; }
${ACTION} {
  appearance: none; -webkit-appearance: none;
  display: inline-flex; align-items: center; justify-content: center;
  width: calc(28px + var(--dsh-content-font-delta, 0px));
  height: calc(28px + var(--dsh-content-font-delta, 0px));
  padding: 4px; margin: 0;
  border: 0 !important; box-shadow: none !important;
  border-radius: var(--dsw-radius-sm, 6px);
  cursor: pointer; outline: none; line-height: 0;
  transition: background 120ms ease, color 120ms ease;
}
${ACTION} svg {
  width: calc(17px + var(--dsh-content-font-delta, 0px));
  height: calc(17px + var(--dsh-content-font-delta, 0px));
}
${ACTION}:hover:not([aria-pressed="true"]) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14)) !important;
  color: var(--dsw-alias-label-secondary, inherit) !important;
}
`

    let styleEl = null
    let observer = null
    let frame = 0
    let sessionKey = ''
    let folded = new Set()
    let foldedCards = new Set()
    const pending = new Set()

    function currentRoute() {
      return location.pathname + location.hash
    }

    function readSet(key) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key))
        return new Set(Array.isArray(parsed) ? parsed : [])
      } catch {
        return new Set()
      }
    }

    function writeSet(key, set) {
      try {
        localStorage.setItem(key, JSON.stringify([...set]))
      } catch {
        /* best-effort persistence */
      }
    }

    function loadState() {
      sessionKey = currentRoute()
      folded = readSet(PREFIX + sessionKey)
      foldedCards = readSet(PREFIX + 'cards:' + sessionKey)
    }

    function saveState() {
      writeSet(PREFIX + sessionKey, folded)
      writeSet(PREFIX + 'cards:' + sessionKey, foldedCards)
    }

    function notify() {
      try {
        window.dispatchEvent(new CustomEvent(EVENT))
      } catch {
        /* dispatch is advisory */
      }
    }

    function rowKey(row) {
      return row.getAttribute('data-chat-node-key') || ''
    }

    function isFoldable(row) {
      return row !== null && !row.closest(PROCESS)
    }

    function contentOf(row) {
      for (const child of row.children) {
        if (child.hasAttribute(STUB)) continue
        return child
      }
      return null
    }

    function previewOf(row) {
      const content = contentOf(row)
      const raw = content ? (content.innerText ?? content.textContent ?? '') : ''
      const text = raw.replace(/\s+/g, ' ').trim()
      if (text.length === 0) return ''
      const head = text.split(' ').slice(0, 14).join(' ')
      return head.length > 44 ? head.slice(0, 44) + '…' : head
    }

    function ensureStub(row, preview) {
      const existing = row.querySelector(':scope > [' + STUB + ']')
      if (existing) return existing
      const stub = document.createElement('div')
      stub.setAttribute(STUB, '')
      stub.title = '点击展开这条回答'
      const label = document.createElement('b')
      label.textContent = '已折叠'
      const hint = document.createElement('span')
      hint.textContent = preview && preview.length > 0 ? '· ' + preview : '· 点击展开'
      stub.append(label, hint)
      stub.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        unfoldRow(row)
        notify()
      })
      row.append(stub)
      return stub
    }

    function foldRow(row) {
      const key = rowKey(row)
      if (key.length === 0) return
      const preview = previewOf(row)
      row.setAttribute('data-dsh-fold', '1')
      folded.add(key)
      saveState()
      ensureStub(row, preview)
    }

    function unfoldRow(row) {
      const key = rowKey(row)
      row.removeAttribute('data-dsh-fold')
      folded.delete(key)
      saveState()
      const stub = row.querySelector(':scope > [' + STUB + ']')
      if (stub) stub.remove()
    }

    function decorate(row) {
      if (!row.isConnected || !isFoldable(row)) return
      const key = rowKey(row)
      if (folded.has(key)) {
        const preview = row.hasAttribute('data-dsh-fold') ? '' : previewOf(row)
        row.setAttribute('data-dsh-fold', '1')
        ensureStub(row, preview)
        return
      }
      if (row.hasAttribute('data-dsh-fold')) {
        row.removeAttribute('data-dsh-fold')
        const stale = row.querySelector(':scope > [' + STUB + ']')
        if (stale) stale.remove()
      }
    }

    /**
     * Split one turn tail into the action strip we injected into and the feature
     * cards (deliverables, changed files) that can be hidden independently.
     * @param {Element | null} tailRoot - the element carrying data-turn-tail.
     * @returns {{ turn: string, strip: Element | null, cards: Element[] }}
     */
    function tailParts(tailRoot) {
      if (!tailRoot) return { turn: '', strip: null, cards: [] }
      const turn = tailRoot.getAttribute('data-turn-tail') || ''
      const children = [...tailRoot.children]
      const strip = children.find((child) => child.querySelector(ACTION) !== null) || null
      const cards = children.filter((child) => child !== strip)
      return { turn, strip, cards }
    }

    function applyCards(tailRoot) {
      const { turn, cards } = tailParts(tailRoot)
      const hide = foldedCards.has(turn)
      for (const card of cards) {
        if (hide) card.setAttribute(HIDDEN, '')
        else card.removeAttribute(HIDDEN)
      }
      return cards.length > 0
    }

    function setTailCards(tailRoot, hide) {
      const { turn } = tailParts(tailRoot)
      if (turn === '') return
      if (hide) foldedCards.add(turn)
      else foldedCards.delete(turn)
      saveState()
      applyCards(tailRoot)
      notify()
    }

    function flush() {
      frame = 0
      if (currentRoute() !== sessionKey) {
        loadState()
        for (const row of document.querySelectorAll(ROW)) pending.add(row)
      }
      const rows = [...pending]
      pending.clear()
      for (const row of rows) decorate(row)
      for (const tailRoot of document.querySelectorAll(TAIL)) {
        if (foldedCards.size === 0) {
          for (const card of tailParts(tailRoot).cards) card.removeAttribute(HIDDEN)
        } else {
          applyCards(tailRoot)
        }
      }
    }

    function schedule() {
      if (frame !== 0) return
      frame = requestAnimationFrame(flush)
    }

    function collect(node) {
      if (!node || node.nodeType !== 1) return
      if (node.matches && node.matches(ROW)) pending.add(node)
      if (node.querySelectorAll) {
        for (const row of node.querySelectorAll(ROW)) pending.add(row)
      }
    }

    function onMutations(records) {
      let touched = false
      for (const record of records) {
        if (record.type !== 'childList') continue
        const target = record.target
        const host = target && target.nodeType === 1 ? target : target && target.parentElement
        if (host && host.closest) {
          const row = host.closest(ROW)
          if (row) pending.add(row)
          if (host.closest(TAIL)) touched = true
        }
        for (const node of record.addedNodes) collect(node)
      }
      if (pending.size > 0 || touched) schedule()
    }

    function uninstall() {
      if (observer) observer.disconnect()
      observer = null
      if (frame !== 0) cancelAnimationFrame(frame)
      frame = 0
      pending.clear()
      if (styleEl) styleEl.remove()
      styleEl = null
      for (const node of document.querySelectorAll('[' + STUB + ']')) node.remove()
      for (const row of document.querySelectorAll(ROW)) row.removeAttribute('data-dsh-fold')
      for (const card of document.querySelectorAll('[' + HIDDEN + ']')) card.removeAttribute(HIDDEN)
    }

    function install() {
      // Always (re)write the stylesheet: a previous instance may have left an
      // older one behind, and skipping the write would keep stale rules alive.
      loadState()
      styleEl = document.getElementById(STYLE_ID)
      if (styleEl === null) {
        styleEl = document.createElement('style')
        styleEl.id = STYLE_ID
        document.head.append(styleEl)
      }
      styleEl.textContent = CSS

      observer = new MutationObserver(onMutations)
      observer.observe(document.body, { childList: true, subtree: true })

      for (const row of document.querySelectorAll(ROW)) pending.add(row)
      schedule()

      return uninstall
    }

    /**
     * Resolve the answer row that owns one action-strip entry: the tail node's
     * nearest preceding 'assistant-step' row in document order.
     * @param {Element | null} stripEl - element inside the turn-tail action row.
     * @returns {Element | null} the answer row, or null when it is not mounted.
     */
    function answerRowFor(stripEl) {
      if (!stripEl) return null
      const tail = stripEl.closest('[data-chat-flow-kind]')
      if (!tail) return null
      for (let el = tail.previousElementSibling; el; el = el.previousElementSibling) {
        if ((el.getAttribute('data-chat-flow-kind') || '') === 'assistant-step') return el
      }
      let found = null
      for (const row of document.querySelectorAll(ROW)) {
        if (row.closest(PROCESS)) continue
        const position = tail.compareDocumentPosition(row)
        if ((position & Node.DOCUMENT_POSITION_PRECEDING) !== 0) found = row
      }
      return found
    }

    function Chevron({ direction }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: direction === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6' }))
    }

    function CardsIcon() {
      return h('svg', {
        viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
      h('rect', { x: 3, y: 5, width: 18, height: 6, rx: 1.5 }),
      h('rect', { x: 3, y: 13, width: 18, height: 6, rx: 1.5 }))
    }

    /**
     * Plain span control: no <button> element, so neither the UA button chrome
     * nor any application rule written for buttons can draw a frame around it.
     * Every visual property is inline, so a stale or missing stylesheet cannot
     * change how it looks.
     */
    const ActionButton = React.forwardRef(function ActionButton({ label, pressed, onActivate, children }, ref) {
      // No element background and no hover state here: the injected stylesheet
      // owns the resting/hover surface, so a missed pointer event can never
      // leave a stuck highlight, and a missing stylesheet simply means no fill.
      const style = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'calc(28px + var(--dsh-content-font-delta, 0px))',
        height: 'calc(28px + var(--dsh-content-font-delta, 0px))',
        padding: '4px',
        margin: 0,
        boxSizing: 'border-box',
        backgroundColor: pressed ? 'var(--dsw-alias-interactive-bg-hover-accent, rgba(38,49,72,0.14))' : 'transparent',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        boxShadow: 'none',
        outline: 'none',
        color: pressed
          ? 'var(--dsw-alias-label-secondary, inherit)'
          : 'var(--dsw-alias-label-tertiary, inherit)',
        cursor: 'pointer',
        lineHeight: 0,
        userSelect: 'none',
      }
      return h('span', {
        ref,
        role: 'button',
        tabIndex: 0,
        title: label,
        'aria-label': label,
        'aria-pressed': pressed,
        'data-dsh-fold-action': '',
        style,
        onClick: onActivate,
        onKeyDown: (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onActivate(event)
        },
      }, children)
    })

    /** Action-strip entries: fold this turn's closing answer, and its feature cards. */
    function FoldAction() {
      const ref = React.useRef(null)
      const [isFolded, setIsFolded] = React.useState(false)
      const [hasCards, setHasCards] = React.useState(false)
      const [cardsFolded, setCardsFolded] = React.useState(false)

      const sync = React.useCallback(() => {
        const row = answerRowFor(ref.current)
        setIsFolded(row !== null && row.hasAttribute('data-dsh-fold'))
        const tailRoot = ref.current ? ref.current.closest(TAIL) : null
        const parts = tailParts(tailRoot)
        setHasCards(parts.cards.length > 0)
        setCardsFolded(parts.turn !== '' && foldedCards.has(parts.turn))
      }, [])

      React.useEffect(() => {
        sync()
        window.addEventListener(EVENT, sync)
        return () => window.removeEventListener(EVENT, sync)
      }, [sync])

      const onFold = React.useCallback((event) => {
        event.preventDefault()
        event.stopPropagation()
        const row = answerRowFor(ref.current)
        if (!row) return
        const next = !row.hasAttribute('data-dsh-fold')
        if (next) foldRow(row)
        else unfoldRow(row)
        setIsFolded(next)
        notify()
      }, [])

      const onCards = React.useCallback((event) => {
        event.preventDefault()
        event.stopPropagation()
        const tailRoot = ref.current ? ref.current.closest(TAIL) : null
        if (!tailRoot) return
        const turn = tailParts(tailRoot).turn
        if (turn === '') return
        const next = !foldedCards.has(turn)
        setCardsFolded(next)
        setTailCards(tailRoot, next)
      }, [])

      const foldLabel = isFolded ? '展开这条回答' : '折叠这条回答'
      const cardsLabel = cardsFolded ? '展开文件卡片' : '折叠文件卡片'

      return h(React.Fragment, null,
        h(ActionButton, {
          ref,
          label: foldLabel,
          pressed: isFolded,
          onActivate: onFold,
        }, h(Chevron, { direction: isFolded ? 'down' : 'up' })),
        hasCards ? h(ActionButton, {
          label: cardsLabel,
          pressed: cardsFolded,
          onActivate: onCards,
        }, h(CardsIcon)) : null,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const dispose = install()
        if (ctx && typeof ctx.effect === 'function') ctx.effect(() => dispose)
        if (ctx && ctx.slots) {
          ctx.effect(() => ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
            name: 'conversation.chat.assistant-actions',
            id: 'fold-answers',
            order: 20,
          }, FoldAction)))
        }
      },
    }
  },
})