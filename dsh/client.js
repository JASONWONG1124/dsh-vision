// Browser half of the dsh-vision plugin: paste-to-path + a settings card.
//
// 1. paste-to-path: a capture-phase paste listener runs before the composer's
//    own handler. When the clipboard carries image files and the selected model
//    is a plain text-only model, the default intake (which would hit host-side
//    image admission) is suppressed; bytes go to POST /dsh-vision/paste, land as
//    a private temp file, and the returned path is inserted as plain text.
// 2. settings card: registers one card in the "Plugins" settings section
//    (settings.plugin.item) that reads/writes ~/.dsh-vision/config.json through
//    the plugin's GET/POST /dsh-vision/config route, so the vision provider +
//    API key + model can be edited from the GUI.
//
// Hand-written in the lazy-CJS bundle protocol (window.__ModuleLoader__.load
// with a factory returning cordis-plugin exports), so no build step.
window.__ModuleLoader__.load({
  id: 'dsh-vision',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement

    // ---- styles (injected once) ----
    var CSS = [
      '.dv-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}',
      '.dv-card:hover{border-color:var(--dsw-alias-label-dimmed)}',
      '.dv-head{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}',
      '.dv-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}',
      '.dv-title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4;flex:1}',
      '.dv-desc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5;margin-top:2px}',
      '.dv-chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}',
      '.dv-chevronOpen{transform:rotate(180deg)}',
      '.dv-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding:14px 0 6px;display:flex;flex-direction:column;gap:12px}',
      '.dv-field{display:flex;flex-direction:column;gap:6px}',
      '.dv-label{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:1.5}',
      '.dv-input,.dv-select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5;box-sizing:border-box;width:100%}',
      '.dv-input:focus-visible,.dv-select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}',
      '.dv-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}',
      '.dv-footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:10px;padding:12px 0 6px;display:flex}',
      '.dv-msg{color:var(--dsw-alias-label-secondary);flex:1;min-width:0;font-size:12px;line-height:1.5}',
      '.dv-save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}',
      '.dv-save:disabled{cursor:default;opacity:.6}',
      '.dv-keyrow{display:flex;align-items:center;gap:8px}',
      '.dv-keyrow .dv-input{flex:1}',
      '.dv-eye{appearance:none;cursor:pointer;background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;height:34px;width:38px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);flex:none}',
      '.dv-eye:hover{color:var(--dsw-alias-label-primary)}',
    ].join('\n')
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="dsh-vision"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-vision'
      tag.dataset.pluginCss = 'dsh-vision'
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function EyeIcon(props) {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
        h('circle', { cx: 12, cy: 12, r: 3 }),
        props.off ? h('line', { x1: 1, y1: 1, x2: 23, y2: 23 }) : null,
      )
    }

    // ---- paste-to-path ----
    function imageFilesOf(event) {
      var items = event.clipboardData && event.clipboardData.items
      if (!items) return []
      var files = []
      for (var i = 0; i < items.length; i++) {
        var item = items[i]
        if (item.kind !== 'file') continue
        var file = item.getAsFile()
        if (file && /^image\//.test(file.type)) files.push(file)
      }
      return files
    }

    function insertText(target, text) {
      var el =
        target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')
          ? target
          : document.activeElement
      if (!el || (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT')) return
      el.focus()
      var inserted = false
      try {
        inserted = document.execCommand('insertText', false, text)
      } catch {
        inserted = false
      }
      if (!inserted) {
        var proto =
          el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set
        setter.call(el, el.value + text)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }

    function uploadOne(file) {
      return file.arrayBuffer().then((buffer) =>
        fetch('/dsh-vision/paste', { method: 'POST', body: buffer }).then((res) => {
          if (!res.ok) {
            return res
              .json()
              .catch(() => ({}))
              .then((body) => {
                throw new Error(body.error || `paste upload failed (${res.status})`)
              })
          }
          return res.json()
        }),
      )
    }

    // The takeover is for text-only models: the "(dsh-vision)" variant converts
    // pastes at request time with the thumbnail preserved, and real vision models
    // read images natively — both keep the original paste UX.
    var VISION_HINT = /\(dsh-vision\)|deepseek-(vl|ocr)|janus|glm-[\d.]*v\b|vision|image/i

    function currentModelLabel() {
      var buttons = document.querySelectorAll('button[aria-label]')
      for (var i = 0; i < buttons.length; i++) {
        var label = buttons[i].getAttribute('aria-label') || ''
        if (/选择模型|select model|current model/i.test(label)) return label
      }
      return ''
    }

    function onPaste(event) {
      var files = imageFilesOf(event)
      if (files.length === 0) return
      if (VISION_HINT.test(currentModelLabel())) return
      event.preventDefault()
      event.stopImmediatePropagation()
      var target = event.target
      Promise.all(files.map(uploadOne))
        .then((results) => {
          var text = results
            .map((r) => r.path)
            .filter(Boolean)
            .join(' ')
          if (text) insertText(target, `${text} `)
        })
        .catch((error) => {
          console.error(`[dsh-vision] paste-to-path failed: ${error && error.message ? error.message : error}`)
        })
    }

    // ---- settings card ----
    function VisionCard() {
      var openState = React.useState(false)
      var open = openState[0]
      var setOpen = openState[1]
      var cfgState = React.useState(null)
      var config = cfgState[0]
      var setConfig = cfgState[1]
      var provState = React.useState('gemini')
      var provider = provState[0]
      var setProvider = provState[1]
      var keyState = React.useState('')
      var apiKey = keyState[0]
      var setApiKey = keyState[1]
      var modelState = React.useState('')
      var model = modelState[0]
      var setModel = modelState[1]
      var baseState = React.useState('')
      var baseUrl = baseState[0]
      var setBaseUrl = baseState[1]
      var savingState = React.useState(false)
      var saving = savingState[0]
      var setSaving = savingState[1]
      var msgState = React.useState('')
      var message = msgState[0]
      var setMessage = msgState[1]
      var showKeyState = React.useState(false)
      var showKey = showKeyState[0]
      var setShowKey = showKeyState[1]

      function applySection(c, p) {
        var s = (c && c[p]) || {}
        setModel(s.model || '')
        setBaseUrl(s.baseUrl || '')
        setApiKey(s.apiKey || '')
      }

      React.useEffect(() => {
        fetch('/dsh-vision/config')
          .then((r) => r.json())
          .then((c) => {
            setConfig(c)
            var p = c.provider || 'gemini'
            setProvider(p)
            applySection(c, p)
          })
          .catch((e) => setMessage('读取配置失败：' + (e && e.message ? e.message : e)))
      }, [])

      function onProvider(p) {
        setProvider(p)
        applySection(config, p)
      }

      function onSave() {
        setSaving(true)
        setMessage('')
        var body = { provider: provider }
        body[provider] = { apiKey: apiKey, model: model, baseUrl: baseUrl }
        fetch('/dsh-vision/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then((r) => r.json())
          .then((res) => {
            setSaving(false)
            if (res && res.ok) {
              setMessage('已保存')
              fetch('/dsh-vision/config')
                .then((r) => r.json())
                .then((c) => {
                  setConfig(c)
                  applySection(c, provider)
                })
            } else {
              setMessage('保存失败：' + (res && res.error ? res.error : ''))
            }
          })
          .catch((e) => {
            setSaving(false)
            setMessage('保存失败：' + (e && e.message ? e.message : e))
          })
      }

      var section = (config && config[provider]) || {}

      var header = h(
        'button',
        { type: 'button', className: 'dv-head', onClick: () => setOpen(!open) },
        h('span', { className: 'dv-title' }, '视觉理解 (dsh-vision)'),
        h(
          'span',
          { className: 'dv-desc' },
          '配置用来“看图”的视觉模型 API —— 填一个 key 即可，无需 CLI',
        ),
        h('span', { className: 'dv-chevron' + (open ? ' dv-chevronOpen' : '') }, '⌄'),
      )

      var body = open
        ? h(
            'div',
            { className: 'dv-body' },
            h(
              'div',
              { className: 'dv-field' },
              h('label', { className: 'dv-label' }, '服务商'),
              h(
                'select',
                { className: 'dv-select', value: provider, onChange: (e) => onProvider(e.target.value) },
                h('option', { value: 'gemini' }, 'Google Gemini'),
                h('option', { value: 'openai' }, 'OpenAI 兼容（通义 / GLM / 自建网关）'),
                h('option', { value: 'anthropic' }, 'Anthropic Claude'),
              ),
            ),
            h(
              'div',
              { className: 'dv-field' },
              h('label', { className: 'dv-label' }, 'API Key'),
              h(
                'div',
                { className: 'dv-keyrow' },
                h('input', {
                  className: 'dv-input',
                  type: showKey ? 'text' : 'password',
                  autoComplete: 'off',
                  value: apiKey,
                  placeholder: '粘贴你的 API Key',
                  onChange: (e) => setApiKey(e.target.value),
                }),
                h(
                  'button',
                  { type: 'button', className: 'dv-eye', title: showKey ? '隐藏' : '显示', onClick: () => setShowKey(!showKey) },
                  EyeIcon({ off: !showKey }),
                ),
              ),
              h('p', { className: 'dv-hint' }, 'Key 会常驻保存；点击右侧眼睛图标可查看/核对字符。'),
            ),
            h(
              'div',
              { className: 'dv-field' },
              h('label', { className: 'dv-label' }, '模型'),
              h('input', {
                className: 'dv-input',
                type: 'text',
                value: model,
                placeholder: provider === 'gemini' ? '例如 gemini-3.6-flash' : provider === 'anthropic' ? '例如 claude-sonnet-4-5' : '例如 qwen-vl-max',
                onChange: (e) => setModel(e.target.value),
              }),
            ),
            h(
              'div',
              { className: 'dv-field' },
              h('label', { className: 'dv-label' }, '接口地址 (baseUrl)'),
              h('input', {
                className: 'dv-input',
                type: 'text',
                value: baseUrl,
                placeholder: '留空使用默认地址',
                onChange: (e) => setBaseUrl(e.target.value),
              }),
              h(
                'p',
                { className: 'dv-hint' },
                provider === 'gemini'
                  ? '默认 https://generativelanguage.googleapis.com'
                  : provider === 'anthropic'
                    ? '默认 https://api.anthropic.com'
                    : '例如 https://dashscope.aliyuncs.com/compatible-mode/v1',
              ),
            ),
            h(
              'div',
              { className: 'dv-footer' },
              message ? h('span', { className: 'dv-msg' }, message) : null,
              h('button', { type: 'button', className: 'dv-save', disabled: saving, onClick: onSave }, saving ? '保存中…' : '保存'),
            ),
          )
        : null

      return h('li', { className: 'dv-card' }, header, body)
    }

    function apply(ctx) {
      document.addEventListener('paste', onPaste, true)
      if (typeof ctx.effect === 'function') {
        ctx.effect(
          () => () => document.removeEventListener('paste', onPaste, true),
          'dsh-vision: paste-to-path listener',
        )
      }
      ctx.slots.inject('settings.plugin.item', function* () {
        yield ctx.slots.register(
          { name: 'settings.plugin.item', id: 'dsh-vision', order: 30 },
          VisionCard,
        )
      })
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
