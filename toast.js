/**
 * Toast.js - A lightweight toast notification library (Tailwind CSS edition)
 * @version 2.0.0
 * @author Kimi
 * @license MIT
 *
 * Requires Tailwind CSS to be included in your project.
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory()
    : typeof define === 'function' && define.amd
      ? define(factory)
      : (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Toast = factory());
}(this, function () {
  'use strict';

  // ===================== Configuration =====================
  const CONFIG = {
    duration: 3000,
    position: 'top-right',
    maxVisible: 5,
  };

  // ===================== Theme tokens (Tailwind classes) =====================
  const THEMES = {
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-400',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-100',
      text: 'text-emerald-950',
      shadow: 'shadow-xl shadow-emerald-500/30',
      progress: 'bg-emerald-500',
      btnConfirm: 'bg-emerald-600',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      iconColor: 'text-red-600',
      iconBg: 'bg-red-100',
      text: 'text-red-950',
      shadow: 'shadow-xl shadow-red-500/30',
      progress: 'bg-red-500',
      btnConfirm: 'bg-red-600',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-400',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
      text: 'text-amber-950',
      shadow: 'shadow-xl shadow-amber-500/30',
      progress: 'bg-amber-500',
      btnConfirm: 'bg-amber-600',
    },
    info: {
      bg: 'bg-sky-50',
      border: 'border-sky-400',
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-100',
      text: 'text-sky-950',
      shadow: 'shadow-xl shadow-sky-500/30',
      progress: 'bg-sky-500',
      btnConfirm: 'bg-sky-600',
    },
    confirm: {
      bg: 'bg-orange-50',
      border: 'border-orange-400',
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-100',
      text: 'text-orange-950',
      shadow: 'shadow-xl shadow-orange-500/30',
      progress: 'bg-orange-500',
      btnConfirm: 'bg-orange-600',
    },
  };

  const ICONS = {
    success: `<i class="fa-solid fa-circle-check"></i>`,
    error: `<i class="fa-solid fa-circle-xmark"></i>`,
    warning: `<i class="fa-solid fa-triangle-exclamation"></i>`,
    info: `<i class="fa-solid fa-circle-info"></i>`,
    confirm: `<i class="fa-solid fa-circle-question"></i>`,
    close: `<i class="fa-solid fa-xmark"></i>`
  };

  const POS_CLASSES = {
    'top-right': 'fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none',
    'top-left': 'fixed top-5 left-5 z-50 flex flex-col gap-3 pointer-events-none',
    'top-center': 'fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 pointer-events-none',
    'bottom-right': 'fixed bottom-5 right-5 z-50 flex flex-col-reverse gap-3 pointer-events-none',
    'bottom-left': 'fixed bottom-5 left-5 z-50 flex flex-col-reverse gap-3 pointer-events-none',
    'bottom-center': 'fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse gap-3 pointer-events-none',
  };

  // ===================== State =====================
  let cssInjected = false;
  const activeToasts = [];
  let confirmModal = null;

  // ===================== Inject only keyframes + minimal animation classes =====================
  function injectStyles() {
    if (cssInjected) return;
    cssInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tsi-r{from{opacity:0;transform:translateX(60px) scale(.92)}to{opacity:1;transform:translateX(0) scale(1)}}
      @keyframes tsi-l{from{opacity:0;transform:translateX(-60px) scale(.92)}to{opacity:1;transform:translateX(0) scale(1)}}
      @keyframes tsi-c{from{opacity:0;transform:translateY(-20px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes tso-r{from{opacity:1;transform:translateX(0) scale(1)}to{opacity:0;transform:translateX(60px) scale(.92)}}
      @keyframes tso-l{from{opacity:1;transform:translateX(0) scale(1)}to{opacity:0;transform:translateX(-60px) scale(.92)}}
      @keyframes tso-c{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(-20px) scale(.92)}}
      @keyframes cf-in{from{opacity:0}to{opacity:1}}
      @keyframes cf-out{from{opacity:1}to{opacity:0}}
      @keyframes cs-in{from{opacity:0;transform:scale(.88) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes cs-out{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(.92) translateY(10px)}}

      .te-r{animation:tsi-r .4s cubic-bezier(.16,1,.3,1) forwards}
      .te-l{animation:tsi-l .4s cubic-bezier(.16,1,.3,1) forwards}
      .te-c{animation:tsi-c .4s cubic-bezier(.16,1,.3,1) forwards}
      .tx-r{animation:tso-r .3s cubic-bezier(.16,1,.3,1) forwards;pointer-events:none}
      .tx-l{animation:tso-l .3s cubic-bezier(.16,1,.3,1) forwards;pointer-events:none}
      .tx-c{animation:tso-c .3s cubic-bezier(.16,1,.3,1) forwards;pointer-events:none}
      .co-in{animation:cf-in .25s ease forwards}
      .co-out{animation:cf-out .2s ease forwards}
      .cm-in{animation:cs-in .35s cubic-bezier(.16,1,.3,1) forwards}
      .cm-out{animation:cs-out .25s cubic-bezier(.16,1,.3,1) forwards}
    `;
    document.head.appendChild(style);
  }

  // ===================== Helpers =====================
  function c(...parts) { return parts.filter(Boolean).join(' ') }

  function getEnterCls(position) {
    if (position === 'top-center' || position === 'bottom-center') return 'te-c'
    if (position === 'top-left' || position === 'bottom-left') return 'te-l'
    return 'te-r'
  }
  function getExitCls(position) {
    if (position === 'top-center' || position === 'bottom-center') return 'tx-c'
    if (position === 'top-left' || position === 'bottom-left') return 'tx-l'
    return 'tx-r'
  }

  function getContainer(position) {
    const clsName = `toast-container--${position}`
    let el = document.querySelector('.' + clsName)
    if (!el) {
      el = document.createElement('div')
      el.className = c(clsName, POS_CLASSES[position] || POS_CLASSES['top-right'])
      document.body.appendChild(el)
    }
    return el
  }

  // ===================== Toast =====================
  function createToast(message, options = {}) {
    injectStyles()
    const type = options.type || 'info'
    const theme = THEMES[type] || THEMES.info
    const duration = options.duration ?? CONFIG.duration
    const position = options.position || CONFIG.position
    const closable = options.closable !== false
    const title = options.title || ''
    const container = getContainer(position)

    const toast = document.createElement('div')
    toast.dataset.position = position
    toast.className = c(
      'toast-item pointer-events-auto flex gap-3 px-5 py-4 rounded-xl border min-w-[280px] max-w-[420px] relative overflow-hidden cursor-default font-sans text-sm leading-relaxed backdrop-blur-sm transition-all duration-300',
      title ? 'items-start' : 'items-center',
      theme.bg, theme.border, theme.text, theme.shadow,
      getEnterCls(position)
    )

    const iconWrap = document.createElement('div');
    iconWrap.className = c(
      'shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center',
      theme.iconBg,
      theme.iconColor
    );
    iconWrap.innerHTML = ICONS[type] || ICONS.info;

    const content = document.createElement('div')
    content.className = 'flex-1 min-w-0 pt-px'

    if (title) {
      const t = document.createElement('div')
      t.className = c('font-semibold text-sm mb-0.5', theme.text)
      t.textContent = title
      content.appendChild(t)
    }

    const msg = document.createElement('div')
    msg.className = 'text-[13px] opacity-85 break-words'
    msg.textContent = message
    content.appendChild(msg)

    toast.appendChild(iconWrap)
    toast.appendChild(content)

    if (closable) {
      const btn = document.createElement('button')
      btn.className = c('shrink-0 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer opacity-50 hover:opacity-100 hover:bg-black/[0.06] transition-all duration-200 mt-px ml-1 border-0 bg-transparent p-0', theme.text)
      btn.innerHTML = ICONS.close
      btn.addEventListener('click', () => removeToast(toast))
      toast.appendChild(btn)
    }

    let progressBar = null
    if (duration > 0 && options.showProgress !== false) {
      progressBar = document.createElement('div')
      progressBar.className = c('absolute bottom-0 left-0 h-[3px] rounded-bl-xl', theme.progress)
      progressBar.style.cssText = 'width:100%;opacity:0.5'
      toast.appendChild(progressBar)
    }

    if (position.startsWith('bottom')) container.insertBefore(toast, container.firstChild)
    else container.appendChild(toast)

    activeToasts.push(toast)
    if (activeToasts.length > CONFIG.maxVisible) {
      const oldest = activeToasts[0]
      if (oldest !== toast) removeToast(oldest)
    }

    if (progressBar && duration > 0) {
      requestAnimationFrame(() => {
        progressBar.style.transition = `width ${duration}ms linear`
        requestAnimationFrame(() => { progressBar.style.width = '0%' })
      })
    }

    let timer = null
    if (duration > 0) timer = setTimeout(() => removeToast(toast), duration)

    if (duration > 0 && options.pauseOnHover !== false) {
      toast.addEventListener('mouseenter', () => {
        if (timer) clearTimeout(timer)
        if (progressBar) {
          const w = getComputedStyle(progressBar).width
          progressBar.style.transition = 'none'
          progressBar.style.width = w
        }
      })
      toast.addEventListener('mouseleave', () => {
        timer = setTimeout(() => removeToast(toast), duration * 0.5)
        if (progressBar) {
          progressBar.style.transition = `width ${duration * 0.5}ms linear`
          progressBar.style.width = '0%'
        }
      })
    }

    toast._remove = () => removeToast(toast)
    return toast
  }

  function removeToast(toast) {
    const i = activeToasts.indexOf(toast)
    if (i === -1) return
    activeToasts.splice(i, 1)

    const pos = toast.dataset.position || CONFIG.position
    toast.classList.remove(getEnterCls(pos))
    toast.classList.add(getExitCls(pos))

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast)
      document.querySelectorAll('[class*="toast-container--"]').forEach(el => {
        if (!el.children.length) el.remove()
      })
    }, 350)
  }

  // ===================== Confirm Modal =====================
  function createConfirm(options = {}) {
    injectStyles()

    const title = options.title || '确认操作'
    const message = options.message || '您确定要执行此操作吗？'
    const confirmText = options.confirmText || '确认'
    const cancelText = options.cancelText || '取消'
    const type = options.type || 'confirm'
    const theme = THEMES[type] || THEMES.confirm
    const onConfirm = options.onConfirm || (() => { })
    const onCancel = options.onCancel || (() => { })

    if (confirmModal) {
      document.body.removeChild(confirmModal)
      confirmModal = null
    }

    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-[10000] flex items-center justify-center co-in font-sans'
    confirmModal = overlay

    const modal = document.createElement('div')
    modal.className = 'bg-white rounded-2xl shadow-2xl p-8 max-w-[400px] w-[90%] text-center cm-in'

    const iconWrap = document.createElement('div')
    iconWrap.className = c('w-16 h-16 rounded-full inline-flex items-center justify-center mb-5', theme.iconBg, theme.iconColor)
    iconWrap.innerHTML = ICONS[type] || ICONS.confirm

    const titleEl = document.createElement('h3')
    titleEl.className = 'text-lg font-bold text-slate-900 mb-2 leading-tight'
    titleEl.textContent = title

    const msgEl = document.createElement('p')
    msgEl.className = 'text-sm text-slate-500 mb-7 leading-relaxed'
    msgEl.textContent = message

    const actions = document.createElement('div')
    actions.className = 'flex gap-2.5 justify-center'

    // 确认按钮在左边
    const confirmBtn = document.createElement('button')
    confirmBtn.className = c('py-2.5 px-5 rounded-lg text-sm font-semibold cursor-pointer border-0 outline-none transition-all duration-200 font-inherit min-w-[90px] text-white hover:-translate-y-px active:translate-y-0 hover:brightness-110', theme.btnConfirm)
    confirmBtn.textContent = confirmText
    confirmBtn.addEventListener('click', () => { close(); onConfirm() })

    // 取消按钮在右边
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'py-2.5 px-5 rounded-lg text-sm font-semibold cursor-pointer border-0 outline-none transition-all duration-200 font-inherit min-w-[90px] bg-slate-100 text-slate-600 hover:bg-slate-200 hover:-translate-y-px active:translate-y-0'
    cancelBtn.textContent = cancelText
    cancelBtn.addEventListener('click', () => { close(); onCancel() })

    // 先添加确认按钮，再添加取消按钮（确定在左，取消在右）
    actions.appendChild(confirmBtn)
    actions.appendChild(cancelBtn)
    modal.appendChild(iconWrap)
    modal.appendChild(titleEl)
    modal.appendChild(msgEl)
    modal.appendChild(actions)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    overlay.addEventListener('click', e => {
      if (e.target === overlay) { close(); onCancel() }
    })

    const onKey = e => {
      if (e.key === 'Escape') { close(); onCancel(); document.removeEventListener('keydown', onKey) }
      else if (e.key === 'Enter') { close(); onConfirm(); document.removeEventListener('keydown', onKey) }
    }
    document.addEventListener('keydown', onKey)

    function close() {
      overlay.classList.add('co-out')
      modal.classList.remove('cm-in')
      modal.classList.add('cm-out')
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
        if (confirmModal === overlay) confirmModal = null
      }, 300)
      document.removeEventListener('keydown', onKey)
    }

    return { close }
  }

  // ===================== Public API =====================
  const Toast = {
    success(msg, opt) { return createToast(msg, { ...opt, type: 'success' }) },
    error(msg, opt) { return createToast(msg, { ...opt, type: 'error' }) },
    warning(msg, opt) { return createToast(msg, { ...opt, type: 'warning' }) },
    info(msg, opt) { return createToast(msg, { ...opt, type: 'info' }) },
    confirm(opt) { return createConfirm(opt) },
    config(opt) { Object.assign(CONFIG, opt); return this },
    clear() {
      ;[...activeToasts].forEach(t => t._remove?.() || removeToast(t))
      activeToasts.length = 0
    },
  }

  return Toast
}))
