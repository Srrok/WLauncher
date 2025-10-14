//Библиотеки
import { JSX, createSignal, onMount, onCleanup, createEffect, splitProps } from "solid-js"
import { getCurrentWindow as program } from "@tauri-apps/api/window"

//Стили диалогового окна
import "./styles/index.scss"
import { render } from "solid-js/web"

//Тип диалогового окна
export type DialogType = (JSX.HTMLAttributes<HTMLDivElement> | JSX.HTMLAttributes<HTMLFormElement> | JSX.HTMLAttributes<HTMLElement>) & {
  style?: JSX.CSSProperties & {"header-color": string}
  type?: "form" | "div" | "section",
  title?: string,
  window?: {
    pinnable?: boolean,
    resizable?: boolean,
    draggable?: boolean,
    center?: boolean,
    toolbar?: {
      close?: boolean | Required<JSX.CustomEventHandlersCamelCase<HTMLButtonElement>>["onClick"],
      minimize?: boolean,
      maximize?: boolean
    } | boolean
  }
} & ({title: string} & {icon?: string} | {title?: undefined} & {icon?: never})

//Тип координат
export type CoordinatesType = {x: number, y: number}

//Многоуровневая очистка типов от неопределённости
export type DeepRemoveUndefined<T> = T extends object ? {[K in keyof T]-?: Exclude<DeepRemoveUndefined<T[K]>, undefined>} : T

//Состояние для позиции окна
let modalRef: HTMLDivElement | undefined

//Базовое уведомление
export const Alert = {
  //Базовый компонент
  Component: (props: {title?: string, type?: "notify" | "warn" | "error", children: string} & ({title: string} & {icon?: string} | {title?: undefined} & {icon?: never})) => <Modal 
    type="div"
    class={props.type ?? "notify"}
    {...props.type !== "notify" && {style: (() => {switch (props.type) {
      case "warn": return {
        "header-color": "var(--warning-color)"
      }
      case "error": return {
        "header-color": "var(--close_button_color)"
      }
      default: return {
        "header-color": "var(--main_submenu_color)"
      }
    }})()}}
    title={props.title ?? ((field: string = props.type ?? "notify") => {switch (field) {
      case "error": return "Ошибка"
      case "notify": return "Уведомление"
      case "warn": return "Предупреждение"
      default: return "Уведомление"
    }})()}
    icon={props.icon ?? ((field: string = props.type ?? "notify") => {switch (field) {
      case "notify": return "fa-solid fa-bell"
      case "error": return "fa-solid fa-circle-exclamation"
      case "warn": return "fa-solid fa-triangle-exclamation"
      default: return "fa-solid fa-bell"
    }})()}
    window={{pinnable: false, resizable: false, center: true, toolbar: {maximize: false}}}
  ><p>{props.children}</p></Modal>,
  
  //Функция демонстрации уведомления
  show: (message: string, props?: {title?: string, parent?: HTMLElement | JSX.Element, type?: "notify" | "warn" | "error"} & ({title: string} & {icon?: string} | {title?: undefined} & {icon?: never})) => {
    //Получаем родительский элемент
    const parent = props?.parent ?? document.getElementById(import.meta.env.PUBLIC_ROOT_ELEMENT ?? "window")
    //Получаем родительский элемент как контейнер
    const element = (parent instanceof HTMLElement ? parent : ((parent as any).props?.id ? document.getElementById((parent as any).props?.id) || document.body : document.body))
    //Рендерим JSX компонент в родительский контейнер
    const dispose = render(() => Alert.Component(props ? {...props, children: message} : {children: message}), element)
    //Возвращаем как DOM функцию
    return () => {dispose(); element.remove()}
  },

  //Вспомогательные методы для частых случаев
  notify: (message: string, title?: string) => Alert.show(message, {type: "notify", title}),
  warn: (message: string, title?: string) => Alert.show(message, {type: "warn", title: title ?? "Предупреждение"}),
  error: (message: string, title?: string) => Alert.show(message, {type: "error", title: title ?? "Ошибка"})
}

//Базовое подтверждение
export const Confirm = {
  //Базовый компонент
  Component: (props: {title?: string, children: string, selectors?: {
    yes?: {label: string, icon: string} | string,
    no?: {label: string, icon: string} | string
  }, onResult?: (value: boolean) => void} & ({title: string} & {icon?: string} | {title?: undefined} & {icon?: never})) => {
    //Ссылки на компоненты окна
    let modalRef: HTMLDivElement | undefined
    
    //Обработчик отмены
    const handleCancel = () => props?.onResult?.(false)

    //Возвращаем компонент
    return <Modal 
      type="div"
      class="confirm"
      ref={modalRef}
      {...props?.icon && {icon: props.icon}}
      title={props.title ?? "Подтверждение"}
      window={{pinnable: false, resizable: false, center: true, toolbar: {maximize: false, close: handleCancel}}}
    >
      <p>{props.children}</p>
      <ModalRow>
        <ModalField icon={props.selectors?.yes ? (typeof props.selectors?.yes !== "string" ? props.selectors?.yes?.icon : "fa-solid fa-check") : "fa-solid fa-check"} kind="button" onClick={() => props?.onResult?.(true)}>{
          props.selectors?.yes ? (typeof props.selectors?.yes !== "string" ? props.selectors?.yes.label : props.selectors?.yes) : "Ок"
        }</ModalField>
        <ModalField icon={props.selectors?.no ? (typeof props.selectors?.no !== "string" ? props.selectors?.no?.icon : "fa-solid fa-ban") : "fa-solid fa-ban"} kind="button" class="red" onClick={handleCancel}>{
          props.selectors?.no ? (typeof props.selectors?.no !== "string" ? props.selectors?.no.label : props.selectors?.no) : "Отмена"
        }</ModalField>
      </ModalRow>
    </Modal>
  },
  
  //Функция демонстрации окна подтверждения
  show: (message: string, props?: {title?: string, selectors?: {
    yes?: {label: string, icon: string} | string,
    no?: {label: string, icon: string} | string
  }, parent?: HTMLElement | JSX.Element} & ({title: string} & {icon?: string} | {title?: undefined} & {icon?: never})): Promise<boolean> => {
    return new Promise((resolve) => {
      //Получаем родительский элемент
      const parent = props?.parent ?? document.getElementById(import.meta.env.PUBLIC_ROOT_ELEMENT ?? "window")
      //Получаем родительский элемент как контейнер
      const element = (parent instanceof HTMLElement ? parent : ((parent as any).props?.id ? document.getElementById((parent as any).props?.id) || document.body : document.body))
      //Рендерим JSX компонент в родительский контейнер
      const dispose = render(() => Confirm.Component({
        ...(props ? {...props, children: message} : {children: message}),
        onResult: (value: boolean) => {resolve(value); dispose(); element.remove()}
      }), element)
    })
  }
}

//Базовое поле ввода
export const Prompt = {
  //Базовый компонент
  Component: <T extends string | number = string>(props: {
    title?: string, 
    children?: string, 
    type?: "string" | "number",
    onResult?: (value: T | undefined) => void
  } & ({title: string} & {icon?: string} | {title?: undefined} & {icon?: never})) => {
    //Ссылки на компоненты окна
    let inputRef: HTMLInputElement | undefined
    let modalRef: HTMLDivElement | undefined

    //Функция преобразования значения
    const parseValue = (value: string): T | undefined => {
      //Получаем строку значений
      const trimmed = value.trim()
      //Если строки нет - выходим
      if (!trimmed) return undefined
      //Возвращаем результат ввода числового значения
      if (props.type === "number") return isNaN(parseFloat(trimmed)) ? undefined : parseFloat(trimmed) as T
      //Возвращаем значение с типом
      return trimmed as T
    }

    //Обработчик отмены окна
    const handleCancel = () => props.onResult?.(undefined)

    //Возвращаем компонент
    return <Modal 
      type="form"
      class="red"
      ref={modalRef}
      onSubmit={(e: Event) => {
        //Прерываем обработку
        e.preventDefault()
        //Возвращаем результат
        props.onResult?.(inputRef?.value ? parseValue(inputRef?.value) : undefined)
      }}
      {...props.icon && {icon: props.icon}}
      title={props.title ?? "Ввод значения"}
      window={{pinnable: false, resizable: false, center: true, toolbar: {maximize: false, close: handleCancel}}}
    >
      <ModalField 
        kind="input"
        ref={inputRef}
        value={props.children ?? ""}
        type={props.type === "number" ? "number" : "text"}
        onInput={(e) => {if (inputRef) inputRef.value = e.currentTarget.value}}
        onKeyDown={(e: KeyboardEvent) => {
          //Обработка нажатия Enter с прерыванием стандартной обработки
          if (e.key === "Enter") {e.preventDefault(); props.onResult?.(inputRef?.value ? parseValue(inputRef?.value) : undefined)}
          //Обработка нажатия Escape с прерыванием стандартной обработки
          if (e.key === "Escape") {e.preventDefault(); props.onResult?.(undefined)}
        }}
      >{props.title ?? "Ввод значения"}</ModalField>
      <ModalRow>
        <ModalField icon="fa-solid fa-check" kind="button" type="submit" onClick={() => props.onResult?.(inputRef?.value ? parseValue(inputRef?.value) : undefined)}>
          {props.title ?? "Ок"}
        </ModalField>
        <ModalField icon="fa-solid fa-ban" kind="button" class="red" onClick={handleCancel}>
          {props.title ?? "Отмена"}
        </ModalField>
      </ModalRow>
    </Modal>
  },
  
  //Функция демонстрации окна ввода
  show: <T extends string | number = string>(props?: {
    title?: string, 
    default?: string, 
    parent?: HTMLElement | JSX.Element,
    type?: "string" | "number"
  } & ({title: string} & {icon?: string} | {title?: undefined} & {icon?: never})): Promise<T | undefined> => {
    return new Promise((resolve) => {
      //Получаем родительский элемент
      const parent = props?.parent ?? document.getElementById(import.meta.env.PUBLIC_ROOT_ELEMENT ?? "window")
      //Получаем родительский элемент как контейнер
      const element = (parent instanceof HTMLElement ? parent : ((parent as any).props?.id ? document.getElementById((parent as any).props?.id) || document.body : document.body))
      //Рендерим JSX компонент в родительский контейнер
      const dispose = render(() => Prompt.Component<T>({
        ...(props && props.default ? {...props, children: props.default} : (props ?? {})),
        onResult: (value: T | undefined) => {resolve(value); dispose(); element.remove()}
      }), element)
    })
  }
}

//Линейный ряд элементов окна
export const ModalRow = (props: {children: JSX.Element}) => {
  //Возвращаем результат
  return <section class="row">
    {props.children}
  </section>
}

//Тип поля ввода текста
type TextareaProps = {
  type?: never,
  icon?: string,
  children: string,
  kind?: "textarea",
  autoscroll?: boolean,
} & Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "children">

//Тип поля ввода
type InputProps = {
  icon?: string,
  kind?: "input",
  children: string,
  type?: Omit<Required<JSX.InputHTMLAttributes<HTMLInputElement>["type"]>, "image">
} & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "children">

//Тип поля ввода
type ButtonProps = {
  icon?: string,
  kind?: "button",
  children: string,
  type?: Required<JSX.ButtonHTMLAttributes<HTMLButtonElement>["type"]>
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children">

//Поле ввода модального окна
export const ModalField = (props: TextareaProps | InputProps | ButtonProps) => {
  //Вставляем значение по умолчанию
  props.kind = props.kind ?? "input"
  //Функции - валидаторы
  const isButton = (props: TextareaProps | InputProps | ButtonProps): props is ButtonProps => {return props.kind === "button"}
  const isTextarea = (props: TextareaProps | InputProps | ButtonProps): props is TextareaProps => {return props.kind === "textarea"}
  let textareaRef: HTMLTextAreaElement | undefined
  //Возвращаем результат
  return <div>
    {isTextarea(props) ? <textarea ref={textareaRef} autocomplete={props.autocomplete ?? "off"} {...splitProps(props, ["icon", "kind", "autoscroll"])[1]} {...props.id && {id: props.id, name: props.id}} placeholder={props.children ?? " "} onInput={(e) => {
      //Если автоматичесий скрол
      if ((props.autoscroll ?? true) && !(textareaRef?.closest(".modal-window")?.classList.contains("pinned") ?? false)) {
        //Автоматический скролл
        e.target.style.height = "auto"
        e.target.style.height = `${e.target.scrollHeight}px`
      }
      //Если есть пользовательское событие
      if (props.onInput) {
        //Вызываем пользовательский обработчик после собственного
        if (typeof props.onInput === "function") props.onInput(e)
        else if (Array.isArray(props.onInput)) {
          //Получаем обработчик и аргумент
          const [handler, arg] = props.onInput
          //Вызываем событие
          handler(arg, e)
        }
      }
    }}/> : (isButton(props) ? <button 
      {...splitProps(props, ["icon", "kind"])[1]}
      title={props.children}
      value={props.children}
      type={props.type ?? "button"}
      onMouseDown={(e) => {
        //Добавляем класс анимации
        e.target.classList.add("animating")
        //Если есть пользовательское событие
        if (props.onMouseDown) {
          //Вызываем пользовательский обработчик после собственного
          if (typeof props.onMouseDown === 'function') props.onMouseDown(e)
          else if (Array.isArray(props.onMouseDown)) {
            //Получаем обработчик и аргумент
            const [handler, arg] = props.onMouseDown
            //Вызываем событие
            handler(arg, e)
          }
        }
      }}
      onAnimationEnd={(e) => {
        //Удаляем класс анимации
        e.target.classList.remove('animating')
        //Если есть пользовательское событие
        if (props.onAnimationEnd) {
          //Вызываем пользовательский обработчик после собственного
          if (typeof props.onAnimationEnd === 'function') props.onAnimationEnd(e)
          else if (Array.isArray(props.onAnimationEnd)) {
            //Получаем обработчик и аргумент
            const [handler, arg] = props.onAnimationEnd
            //Вызываем событие
            handler(arg, e)
          }
        }
      }}
      onMouseLeave={(e) => {
        //Создаём задержку из стилей SCSS перед удалением класса анимации
        setTimeout(() => e.target.classList.remove('animating'), ((): number => {
          //Получаем правила из SCSS стилей
          const rule = Array.from(document.styleSheets)
            .flatMap(sheet => Array.from(sheet.cssRules))
            .find(rule => rule.cssText.includes('.animating') && rule.cssText.includes('animation'))
          //Возвращаем значение в миллисекундах
          return rule ? parseFloat(rule.cssText.match(/animation:[^;]*?([\d.]+)(m?s)/)?.[1] || '0') * (rule.cssText.includes('ms') ? 1 : 1000) : 0
        })())
        //Если есть пользовательское событие
        if (props.onMouseLeave) {
          //Вызываем пользовательский обработчик после собственного
          if (typeof props.onMouseLeave === 'function') props.onMouseLeave(e)
          else if (Array.isArray(props.onMouseLeave)) {
            //Получаем обработчик и аргумент
            const [handler, arg] = props.onMouseLeave
            //Вызываем событие
            handler(arg, e)
          }
        }
      }}
      {...props.id && {id: props.id, name: props.id}}
    >{props.icon && <i class={props.icon}/>}{props.children}</button> : <><input autocomplete={props.autocomplete ?? "off"}
      {...splitProps(props, ["icon", "kind"])[1]}
      placeholder={props.children ?? " "}
      type={props.type ?? "text"}
      {...props.id && {id: props.id, name: props.id}}
      {...["submit", "reset", "button"].includes(props.type ?? "text") && {
        title: props.children,
        value: props.children,
        onMouseDown: (e) => {
          //Добавляем класс анимации
          e.target.classList.add("animating")
          //При наличии иконки добавляем анимацию
          if (e.target.querySelector("i")) e.target.querySelector("i")!.classList.add("animating")
          //Если есть пользовательское событие
          if (props.onMouseDown) {
            //Вызываем пользовательский обработчик после собственного
            if (typeof props.onMouseDown === 'function') props.onMouseDown(e)
            else if (Array.isArray(props.onMouseDown)) {
              //Получаем обработчик и аргумент
              const [handler, arg] = props.onMouseDown
              //Вызываем событие
              handler(arg, e)
            }
          }
        },
        onAnimationEnd: (e) => {
          //Удаляем класс анимации
          e.target.classList.remove('animating')
          //При наличии иконки удаляем анимацию
          if (e.target.querySelector("i")) e.target.querySelector("i")!.classList.remove("animating")
          //Если есть пользовательское событие
          if (props.onAnimationEnd) {
            //Вызываем пользовательский обработчик после собственного
            if (typeof props.onAnimationEnd === 'function') props.onAnimationEnd(e)
            else if (Array.isArray(props.onAnimationEnd)) {
              //Получаем обработчик и аргумент
              const [handler, arg] = props.onAnimationEnd
              //Вызываем событие
              handler(arg, e)
            }
          }
        },
        onMouseLeave: (e) => {
          //Создаём задержку из стилей SCSS перед удалением класса анимации
          setTimeout(() => e.target.classList.remove('animating'), ((): number => {
            //Получаем правила из SCSS стилей
            const rule = Array.from(document.styleSheets)
              .flatMap(sheet => Array.from(sheet.cssRules))
              .find(rule => rule.cssText.includes('.animating') && rule.cssText.includes('animation'))
            //Возвращаем значение в миллисекундах
            return rule ? parseFloat(rule.cssText.match(/animation:[^;]*?([\d.]+)(m?s)/)?.[1] || '0') * (rule.cssText.includes('ms') ? 1 : 1000) : 0
          })())
          //При наличии иконки создаём задержку из стилей SCSS перед удалением класса анимации из иконки
          if (e.target.querySelector("i")) setTimeout(() => e.target.querySelector("i")!.classList.remove('animating'), ((): number => {
            //Получаем правила из SCSS стилей
            const rule = Array.from(document.styleSheets)
              .flatMap(sheet => Array.from(sheet.cssRules))
              .find(rule => rule.cssText.includes('.animating') && rule.cssText.includes('animation'))
            //Возвращаем значение в миллисекундах
            return rule ? parseFloat(rule.cssText.match(/animation:[^;]*?([\d.]+)(m?s)/)?.[1] || '0') * (rule.cssText.includes('ms') ? 1 : 1000) : 0
          })())
          //Если есть пользовательское событие
          if (props.onMouseLeave) {
            //Вызываем пользовательский обработчик после собственного
            if (typeof props.onMouseLeave === 'function') props.onMouseLeave(e)
            else if (Array.isArray(props.onMouseLeave)) {
              //Получаем обработчик и аргумент
              const [handler, arg] = props.onMouseLeave
              //Вызываем событие
              handler(arg, e)
            }
          }
        }
      }}
    />{(props.icon && ["submit", "reset", "button"].includes(props.type ?? "text")) && <i class={props.icon}/>}</>)}
    {(!["submit", "reset", "button"].includes(props.type ?? "text") && props.kind !== "button") && <>
      <div class="focus">
        {(props.icon || ["search", "file"].includes(props.type ?? "text")) && <i class={props.icon ?? (props.type === "search" ? "fa-solid fa-magnifying-glass" : "fa-solid fa-folder-open")}/>}
        <label for={props.id}>{props.children}</label>
      </div>
    </>}
  </div>
}

//Компонент диалогового окна
export default function Modal(props: DialogType) {
  //Тип модального окна
  type ModalType = DeepRemoveUndefined<{[K in keyof Required<DialogType>["window"]]: K extends "toolbar" ? 
    Exclude<Exclude<Required<DialogType>["window"], undefined>[K], boolean> : Exclude<Required<DialogType>["window"], undefined>[K]
  }>
  //Тип карты размеров
  type SizesMap = Map<HTMLElement, {width: string, height: string, maxWidth: string, maxHeight: string, resize: string}>
  let resizeTimeout: NodeJS.Timeout | undefined
  const [isResizing, setIsResizing] = createSignal(false)
  const [isPinned, setPinned] = createSignal<boolean>(false)
  const [isDragging, setIsDragging] = createSignal<boolean>(false)
  const [wasCentered, setWasCentered] = createSignal<boolean>(false)
  const [isFullscreen, setFullscreen] = createSignal<boolean>(false)
  const [position, setPosition] = createSignal<CoordinatesType>({x: 0, y: 0})
  const [dragOffset, setDragOffset] = createSignal<CoordinatesType>({x: 0, y: 0})
  const [resizableElements, setResizableElements] = createSignal<Array<{element: HTMLElement, resize: string}>>([])
  const [relativePosition, setRelativePosition] = createSignal<CoordinatesType>({x: 0.5, y: 0.5})
  const [originalSizes, setOriginalSizes] = createSignal<SizesMap>(new Map())
  const [modal, setModal] = createSignal<ModalType>({
    resizable: props.window?.resizable ?? true,
    draggable: props.window?.draggable ?? true,
    pinnable: props.window?.pinnable ?? true,
    center: props.window?.center ?? false,
    toolbar: {
      close: typeof props.window?.toolbar !== "boolean" ? (props.window?.toolbar?.close ?? true) : props.window.toolbar,
      minimize: typeof props.window?.toolbar !== "boolean" ? (props.window?.toolbar?.minimize ?? true) : props.window.toolbar,
      maximize: typeof props.window?.toolbar !== "boolean" ? (props.window?.toolbar?.maximize ?? true) : props.window.toolbar
    }
  })
  const [windowParams, setWindowParams] = createSignal<{
    position: CoordinatesType,
    borderTop: string,
    radius: string,
    height: string,
    resize: string,
    width: string
  }>()
  
  //Получаем параметры окна
  const startup: ModalType = {
    resizable: props.window?.resizable ?? true,
    draggable: props.window?.draggable ?? true,
    pinnable: props.window?.pinnable ?? true,
    center: props.window?.center ?? true,
    toolbar: {
      close: typeof props.window?.toolbar !== "boolean" ? (props.window?.toolbar?.close ?? true) : props.window.toolbar,
      minimize: typeof props.window?.toolbar !== "boolean" ? (props.window?.toolbar?.minimize ?? true) : props.window.toolbar,
      maximize: typeof props.window?.toolbar !== "boolean" ? (props.window?.toolbar?.maximize ?? true) : props.window.toolbar
    }
  }

  //Функция для обновления относительной позиции
  const updateRelativePosition = () => {
    //Если нет модального окна - выходим
    if (!modalRef) return
    //Получаем коллайдеры окна и родителя
    const modalRect = modalRef.getBoundingClientRect()
    const parentRect = modalRef.parentElement?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, left: 0, top: 0}
    //Выставляем относительную позицию
    setRelativePosition({
      x: Math.max(0, Math.min(1, position().x / Math.max(1, parentRect.width - modalRect.width))),
      y: Math.max(0, Math.min(1, position().y / Math.max(1, parentRect.height - modalRect.height)))
    })
  }

  //Получение случайных координат к центру
  const getRandomPosition = (safeMargin: number = 20): CoordinatesType => {
    //Если нет модального окна - возвращаем ответ
    if (!modalRef) return {x: 0, y: 0}
    //Получаем родительский и собственный коллайдеры
    const modalRect = modalRef.getBoundingClientRect()
    const parentRect = modalRef.parentElement?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, left: 0, top: 0}
    //Вычисляем доступную область для позиционирования с учетом отступов
    const availableWidth = Math.max(0, parentRect.width - modalRect.width - safeMargin * 2)
    const availableHeight = Math.max(0, parentRect.height - modalRect.height - safeMargin * 2)
    //Вычисляем центр безопасной зоны
    const centerX = safeMargin + availableWidth / 2
    const centerY = safeMargin + availableHeight / 2   
    //Возвращаем ответ
    return {
      x: Math.max(safeMargin, Math.min(
        centerX + ((Math.random() - 0.5) * Math.min(availableWidth * 0.3, availableWidth / 2) * 2), parentRect.width - modalRect.width - safeMargin
      )),
      y: Math.max(safeMargin, Math.min(
        centerY + ((Math.random() - 0.5) * Math.min(availableHeight * 0.3, availableHeight / 2) * 2), parentRect.height - modalRect.height - safeMargin
      ))
    }
  }

  //Функция для центрирования окна
  const centerModal = () => {
    //Если нет окна или полноэкранный - возвращаем
    if (!modalRef || isFullscreen()) return
    //Получаем родительский и собственный коллайдеры
    const modalRect = modalRef.getBoundingClientRect()
    const parentRect = modalRef.parentElement?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, left: 0, top: 0}
    //Устанавливаем позицию по центру для окна
    setPosition({x: (parentRect.width - modalRect.width) / 2, y: (parentRect.height - modalRect.height) / 2})
    //Обновляем относительную позицию
    setRelativePosition({x: 0.5, y: 0.5})
    //Окно было центрировано
    setWasCentered(true)
  }

  //При инициализации
  onMount(() => {
    //При запросе на закрытие
    program().onCloseRequested(async (e) => {
      //Прерываем обработку
      e.preventDefault()
      /* ПРОПИСАТЬ ЛОГИКУ СОХРАНЕНИЯ МОДАЛЬНОГО ОКНА, ЕСЛИ ЗАКРЕПЛЕНО */
    })
    //Если есть окно
    if (modalRef) {
      //Если есть разрешение
      if (modal().center) {
        //Центрируем окно
        centerModal()
      } else {
        //Устанавливаем случайную позицию
        setPosition(getRandomPosition())
        //Обновляем относительную позицию
        updateRelativePosition()
      }
      //Если есть разрешение на изменение размеров
      if (modal().resizable) {
        //Тип измерений объекта
        type DimensionType = {ref: HTMLElement, width: string, maxWidth?: string, height: string, maxHeight?: string}
        //Функция получения размеров всех элементов
        const getChildrenDimensions = (element: Element): Array<DimensionType> => Array.from(element.children).flatMap(child => [{
          ref: child as HTMLElement,
          width: `${(child as HTMLElement).getBoundingClientRect().width}px`,
          height: `${(child as HTMLElement).getBoundingClientRect().height}px`,
          ...((child as HTMLElement).style.maxWidth !== "" && {maxWidth: (child as HTMLElement).style.maxWidth}),
          ...((child as HTMLElement).style.maxHeight !== "" && {maxHeight: (child as HTMLElement).style.maxHeight})
        }, ...getChildrenDimensions(child)])
        //Размеры объектов
        let sizes: Array<DimensionType> = []
        //Флаг для отслеживания применения ограничений
        let constraintsApplied = {width: false, height: false}
        //Ссылка на объект взаимодействия
        let targetRef: HTMLElement | undefined
        //Слушатель изменения размеров
        const resizeObserver = new ResizeObserver(() => {
          //Если нет родителя - выходим
          if (!modalRef.parentElement) return
          //При зажатии мыши по объекту растягивания
          const handleMouseDown = (e: MouseEvent) => {
            //Получаем элемент зажатия
            targetRef = e.target as HTMLElement | undefined
            //Удаляем обработчик
            document.removeEventListener("mousedown", handleMouseDown)
          }
          //Привязываем обработчик
          document.addEventListener("mousedown", handleMouseDown)
          //Получаем коллайдеры родителя и элемента
          const parent = modalRef.parentElement.getBoundingClientRect()
          const element = modalRef.getBoundingClientRect()
          //Вычисляем доступное пространство с учётом позиции
          const availableWidth = parent.width - position().x
          const availableHeight = parent.height - position().y
          //Проверяем выход за границы
          const exceedsWidth = element.width > availableWidth
          const exceedsRight = element.right > parent.right
          const exceedsBottom = element.bottom > parent.bottom
          //Если был выход за границы
          if (exceedsWidth || exceedsRight) {
            //Выставляем ограничения
            modalRef.style.maxWidth = `${availableWidth}px`
            constraintsApplied.width = true
          } else if (constraintsApplied.width && !exceedsWidth && !exceedsRight) {
            //Удаляем фиксацию
            modalRef.style.maxWidth = ""
            constraintsApplied.width = false
            //Если нажатие не по основному окну - удаляем ограничение с основного окна
            if (!targetRef?.classList.contains("modal-window")) modalRef.style.width = ""
            //Восстанавливаем оригинальные максимальные ширины дочерних элементов
            sizes.forEach(item => {if (item.maxWidth !== undefined) {item.ref.style.maxWidth = item.maxWidth} else item.ref.style.maxWidth = ""})
          }
          //Если был выход за границы
          if (exceedsBottom) {
            //Выставляем ограничения
            modalRef.style.maxHeight = `${availableHeight}px`
            constraintsApplied.height = true
          } else if (constraintsApplied.height && !exceedsBottom) {
            //Удаляем фиксацию
            modalRef.style.maxHeight = ""
            constraintsApplied.height = false
            //Если нажатие не по основному окну - удаляем ограничение с основного окна
            if (!targetRef?.classList.contains("modal-window")) modalRef.style.height = ""
            //Восстанавливаем оригинальные максимальные высоты дочерних элементов
            sizes.forEach(item => {if (item.maxHeight !== undefined) {item.ref.style.maxHeight = item.maxHeight} else item.ref.style.maxHeight = ""})
          }
          //Состояние обновления
          let needsUpdate = false
          //Корректируем позицию если выходит за границы
          const { newHeight, newWidth } = Object.freeze({
            newHeight: exceedsBottom ? element.height - (element.bottom - parent.bottom) : element.height,
            newWidth: exceedsRight ? element.width - (element.right - parent.right) : element.width
          })
          //Проверяем границы и вызываем обновления
          if (exceedsRight || exceedsBottom) needsUpdate = true
          //Если обновления не нужны - обновляем размеры дочерних элементов
          if (!needsUpdate) sizes = getChildrenDimensions(modalRef)
          //Если разрешены обновления - вызываем обновления
          if (needsUpdate) requestAnimationFrame(() => {
            //Если привышена ширина
            if (newWidth !== element.width && exceedsRight) {
              //Выставляем ограничения
              modalRef.style.width = `${newWidth}px`
              sizes.forEach(item => item.ref.style.maxWidth = item.width)
            } else if (!exceedsRight && modalRef.style.width) {
              //Удаляем ограничения
              sizes.forEach(item => {if (item.maxWidth !== undefined) {item.ref.style.maxWidth = item.maxWidth} else item.ref.style.maxWidth = ""})
            }
            //Если привышена высота
            if (newHeight !== element.height && exceedsBottom) {
              //Выставляем ограничения
              modalRef.style.height = `${newHeight}px`
              sizes.forEach(item => item.ref.style.maxHeight = item.height)
            } else if (!exceedsBottom && modalRef.style.height) {
              //Удаляем ограничения
              sizes.forEach(item => {if (item.maxHeight !== undefined) {item.ref.style.maxHeight = item.maxHeight} else item.ref.style.maxHeight = ""})
            }
          })
        })
        //Привязываем обработчик расширения
        resizeObserver.observe(modalRef)
        //При демонтировании отключаем слежение
        onCleanup(() => resizeObserver.disconnect())
      } else modalRef.style.resize = "none"
    }
    
    //Событие движения мыши при зажатии
    const handleMouseMove = (e: MouseEvent) => {
      //Если не перетаскивание - возвращаем ответ
      if (!isDragging() || !modalRef) return
      //Если перетащили - не считать центрированным
      if (wasCentered()) setWasCentered(false)
      //Получаем родительский и собственный коллайдеры
      const parentRect = modalRef.parentElement?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, left: 0, top: 0}
      const modalRect = modalRef.getBoundingClientRect()
      //Устанавливаем позицию
      const newX = Math.max(0, Math.min(e.clientX - dragOffset().x - parentRect.left, parentRect.width - modalRect.width))
      const newY = Math.max(0, Math.min(e.clientY - dragOffset().y - parentRect.top, parentRect.height - modalRect.height))
      //Выставляем позицию окна
      setPosition({x: newX, y: newY})
      //Обновляем относительную позицию
      setRelativePosition({
        x: newX / Math.max(1, parentRect.width - modalRect.width),
        y: newY / Math.max(1, parentRect.height - modalRect.height)
      })
    }
    
    //Событие зажатия мыши - переключение разрешения
    const handleMouseUp = () => setIsDragging(false)
    
    //Событие изменения размера окна
    const handleResize = () => {
      //Если не указано окно или включен полноэкранный режим
      if (!modalRef || isFullscreen()) return;
      //Если окно было центрировано
      if (wasCentered()) {
        //Центрируем окно
        centerModal()
      } else {
        //Получаем коллайдеры окна и родителя
        const modalRect = modalRef.getBoundingClientRect()
        const parentRect = modalRef.parentElement?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, left: 0, top: 0}
        //Получаем доступную ширину и длинну
        const availableWidth = Math.max(1, parentRect.width - modalRect.width)
        const availableHeight = Math.max(1, parentRect.height - modalRect.height)
        //Выставляем позицию
        setPosition({
          x: Math.max(0, Math.min(relativePosition().x * availableWidth, availableWidth)),
          y: Math.max(0, Math.min(relativePosition().y * availableHeight, availableHeight))
        })
      }
    }
    
    //Добавляем слушатели событий
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("resize", handleResize)
    
    //При очистке
    onCleanup(() => {
      //Удаляем слушатели событий
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("resize", handleResize)
    })
  })

  //Функция перетаскивания окна
  const dragEvent = (e: MouseEvent, isHeader?: boolean) => {
    //Получаем собственный HTML тег в нижнем регистре
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    //Условие для проверки на то, зажата ли кнопка
    const isButton = isHeader ? (["button", "i"].includes(tag) || ((e.target as HTMLElement).parentElement?.tagName.toLowerCase() ?? "button") === "button") : false
    //Если задано окно и нет заголовка
    if (modalRef && !isHeader) {
      //Получаем параметры окна и его SCSS стили
      const rect = modalRef.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(modalRef)
      const resize = computedStyle.resize
      //Получаем реальный размер области растягивания из системного курсора
      const resizeAreaSize = parseInt(computedStyle.cursor.split(' ')[1]) || 8
      //Определяем, с каких сторон разрешено растягивание
      const canResizeHorizontal = resize === 'both' || resize === 'horizontal'
      const canResizeVertical = resize === 'both' || resize === 'vertical'
      //Проверяем, находится ли курсор в активной области растягивания
      if ((canResizeHorizontal && e.clientX >= rect.right - resizeAreaSize) ||
        (canResizeHorizontal && e.clientX <= rect.left + resizeAreaSize) ||
        (canResizeVertical && e.clientY >= rect.bottom - resizeAreaSize) ||
        (canResizeVertical && e.clientY <= rect.top + resizeAreaSize)) return
    }
    //Если нет доступа к окну или разрешения на перетаскивание
    if (!modal().draggable || !modalRef || isButton) return
    //Прерываем стандартную обработку
    e.preventDefault()
    //Устанавливаем состояние перетаскивания
    setIsDragging(true)
    //Получаем коллайдер модального окна
    const rect = modalRef.getBoundingClientRect()
    //Устанавливаем координаты перемещения
    setDragOffset({x: e.clientX - rect.left, y: e.clientY - rect.top})
    //Обновляем относительную позицию
    updateRelativePosition()
  }

  //Существует ли заголовок окна
  const hasHeader = Object.values(modal().toolbar).some(v => v !== false) || modal().pinnable || props.title !== undefined

  //Возвращаем разметку диалогового окна
  return <div ref={modalRef} class="modal-window" datatype-resize={modalRef ? window.getComputedStyle(modalRef).resize : "both"} style={{
    transform: isFullscreen() ? "none" : `translate(${position().x}px, ${position().y}px)`,
    ...(isResizing() && !isFullscreen() && {
      "--translate-x": `${position().x}px`,
      "--translate-y": `${position().y}px`
    }),
    position: "absolute",
    left: "0",
    top: "0"
  }} classList={{"pinned": isPinned(), "fullscreen": isFullscreen(), "resizable": startup.resizable && !isFullscreen(), "draggable": startup.draggable && !isFullscreen()}} onMouseDown={(e) => {
    //Если нет окна или включен полноэкранный режим - выходим
    if (!modalRef || isFullscreen()) return undefined
    //Получаем размеры окна и родителя
    const rect = modalRef.getBoundingClientRect()
    //Проверяем все границы элемента
    const isLeftEdge = e.clientX <= rect.left + Math.min(20, Math.max(8, rect.width * 0.05))
    const isRightEdge = e.clientX >= rect.right - Math.min(20, Math.max(8, rect.width * 0.05))
    const isTopEdge = e.clientY <= rect.top + Math.min(20, Math.max(8, rect.height * 0.05))
    const isBottomEdge = e.clientY >= rect.bottom - Math.min(20, Math.max(8, rect.height * 0.05))
    //Проверяем, что клик был на границе элемента
    if (isLeftEdge || isRightEdge || isTopEdge || isBottomEdge) {
      //Устанавливаем сигнал
      setIsResizing(true)
      //Сбрасываем таймер при новом ресайзе
      if (resizeTimeout) clearTimeout(resizeTimeout)
      //Сохраняем текущие ограничения
      const currentMaxWidth = modalRef.style.maxWidth
      const currentMaxHeight = modalRef.style.maxHeight
      //Немедленно устанавливаем ограничения на основе текущей позиции
      modalRef.style.maxWidth = `calc(100% - ${position().x}px)`
      modalRef.style.maxHeight = `calc(100% - ${position().y}px)`
      //При отпускании мыши
      const handleMouseUp = () => {
        //Восстанавливаем оригинальные ограничения
        modalRef.style.maxWidth = currentMaxWidth
        modalRef.style.maxHeight = currentMaxHeight
        //Сбрасываем сигнал с задержкой
        resizeTimeout = setTimeout(() => setIsResizing(false), 50)
        //Удаляем слушатель из документа
        document.removeEventListener("mouseup", handleMouseUp)
        document.removeEventListener("mousemove", handleMouseMove)
      }
      //Отслеживаем движение мыши
      const handleMouseMove = () => {if (modalRef) {
        //Динамически обновляем ограничения во время ресайза
        modalRef.style.maxWidth = `calc(100% - ${position().x}px)`
        modalRef.style.maxHeight = `calc(100% - ${position().y}px)`
      }}
      //Добавляем слушатель к документу с сигналом
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("mousemove", handleMouseMove)
    }
  }}
  {...(!hasHeader && {classList: {"dragging": isDragging()}, onMouseDown: (e: MouseEvent) => dragEvent(e, false)})}>
    {hasHeader && (() => {
      //Состояние информационного стенда
      const [infoState, setInfoState] = createSignal<boolean>(true)
      //Оригинальная ширина тулбара
      const [toolsWidth, setToolsWidth] = createSignal<string>()
      //При монтировании
      onMount(() => {
        //Выставляем оригинальную ширину тулбара
        setToolsWidth(Array.from(document.styleSheets).flatMap(sheet => Array.from(sheet.cssRules)).find((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText?.includes(".tools"))?.style?.getPropertyValue("width") || "auto")
      })
      //При изменении информации
      createEffect(() => {
        //Получаем тулбар модального окна
        const tools = document.getElementsByClassName("modal-header")[0].querySelector("div.tools") as HTMLDivElement | null
        //Если есть тулбар - выставляем ширину элемента
        if (tools) {if (!infoState()) {tools.style.width = "100%"} else if (toolsWidth()) tools.style.width = toolsWidth()!}
      })
      //Возвращаем разметку
      return <div classList={{"modal-header": true, "dragging": isDragging()}} onMouseDown={(e: MouseEvent) => dragEvent(e, true)}>
        {((props.title && props.icon) || props.title) ? <div class="info">
          {props.icon && <i {...props.style?.["header-color"] && {style: {
            color: props.style["header-color"],
            "--icon-color": props.style["header-color"]
          }}} class={props.icon}/>}
          <h1 {...props.style?.["header-color"] && {style: {color: props.style["header-color"]}}}>{props.title}</h1>
        </div> : (() => {
          //Устанавливаем сигнал
          setInfoState(false)
          //Возвращаем ответ
          return <></>
        })()}
        {(modal().toolbar.minimize || modal().toolbar.maximize || modal().pinnable || modal().toolbar.close) && <div class="tools">
          {modal().pinnable && <button title={isPinned() ? "Открепить" : "Закрепить"} onClick={() => {
            //Меняем результат
            setPinned(!isPinned())
            //Если есть окно
            if (modalRef) {
              //Получаем сигнал закрепления
              const pinned = isPinned()
              //Если закреплено
              if (pinned) {
                //Сохраняем оригинальные размеры
                setOriginalSizes((() => {
                  //Конечная карта размеров
                  const sizesMap: SizesMap = new Map()
                  //Функция для получения размеров всех элементов рекурсивно
                  const getElementsDimensions = (element: Element): HTMLElement[] => {
                    //Список исходных элементов
                    const elements: HTMLElement[] = [element as HTMLElement]
                    //Итерация по массиву дочерних объектов с последующим получением размеров
                    Array.from(element.children).forEach(child => elements.push(...getElementsDimensions(child)))
                    //Возвращаем результат
                    return elements
                  }
                  //Получаем размеры элементов рекурсивно
                  getElementsDimensions(modalRef).forEach(element => sizesMap.set(element, {
                    width: element.style.width || `${element.getBoundingClientRect().width}px`,
                    height: element.style.height || `${element.getBoundingClientRect().height}px`,
                    maxWidth: element.style.maxWidth,
                    maxHeight: element.style.maxHeight,
                    resize: element.style.resize
                  }))
                  //Возвращаем результат
                  return sizesMap
                })())
                //Блокируем изменения размеров
                setResizableElements(([...modalRef.querySelectorAll('*')] as Array<HTMLElement>).filter(e => getComputedStyle(e).resize !== "none" && e.style.resize !== "none").map(e => { 
                  //Свойство растягивания
                  const resize = e.style.resize
                  //Блокируем измененеи размеров
                  e.style.resize = "none"
                  //Возвращаем элементы
                  return {element: e, resize}
                }))
                //Получаем текущую ширину и длинну окна
                const currentWidth = modalRef.style.width || `${modalRef.getBoundingClientRect().width}px`
                const currentHeight = modalRef.style.height || `${modalRef.getBoundingClientRect().height}px`
                //Устанавливаем свойства окна
                setWindowParams({
                  width: currentWidth,
                  height: currentHeight,
                  resize: modalRef.style.resize,
                  radius: modalRef.style.borderRadius,
                  borderTop: modalRef.style.borderTop,
                  position: {x: position().x, y: position().y}
                })
                //Отключаем свойства окна
                setModal({...modal(), resizable: false, draggable: false, toolbar: {close: false, minimize: false, maximize: false}})
                //Удаляем стили растягивания
                modalRef.style.resize = "none"
                //Выставляем ширину и длинну
                modalRef.style.width = currentWidth
                modalRef.style.height = currentHeight
              } else {
                //Активируем свойства окна
                setModal(startup)
                //Возвращаем исходные размеры элементов
                originalSizes().forEach((styles, element) => {
                  element.style.width = styles.width
                  element.style.height = styles.height
                  element.style.maxWidth = styles.maxWidth
                  element.style.maxHeight = styles.maxHeight
                  element.style.resize = styles.resize
                })
                //Очищаем сохраненные размеры
                setOriginalSizes(new Map())
                //Получаем параметры окна
                const params = windowParams()
                //Если параметры заданы и есть разрешение
                if (params && modal().resizable) {
                  //Возвращаем свойство растягивания
                  modalRef.style.resize = params.resize
                  //Возвращаем свойство растягивания дочерним элементам
                  resizableElements().forEach(item => item.element.style.resize = item.resize)
                  //Очищаем список элементов
                  setResizableElements([])
                }
              }
            }
          }}><i class={isPinned() ? "fa-solid fa-thumbtack-slash" : "fa-solid fa-thumbtack"}/></button>}
          {modal().toolbar.minimize && <button title="Свернуть"><i class="fa-solid fa-window-minimize"/></button>}
          {modal().toolbar.maximize && <button 
            title={isFullscreen() ? "Восстановить" : "Развернуть"}
            onClick={() => {
              //Если нет окна - выходим
              if (!modalRef) return
              //Меняем полноэкранный режим
              setFullscreen(!isFullscreen())
              /* ДОРАБОТАТЬ ЛОГИКУ ПОЗИЦИОНИРОВАНИЯ С ПОЛНЫМ ЭКРАНОМ */
              //Если полноэкранный режим
              if (isFullscreen()) {
                //Сохраняем параметры
                setWindowParams({
                  width: modalRef.style.width,
                  height: modalRef.style.height,
                  resize: modalRef.style.resize,
                  radius: modalRef.style.borderRadius,
                  borderTop: modalRef.style.borderTop,
                  position: {x: position().x, y: position().y}
                })
                //Устанавливаем позицию
                setPosition({x: 0, y: 0})
                //Применяем полноэкранные стили
                modalRef.style.borderRadius = "0px"
                modalRef.style.borderTop = "none"
                modalRef.style.height = "100%"
                modalRef.style.resize = "none"
                modalRef.style.width = "100%"
              } else {
                //Получаем параметры окна
                const params = windowParams()
                //Если нет параметров - выходим
                if (!params) return
                //Синхронно устанавливаем позицию (убрали setTimeout)
                setPosition({x: params.position.x, y: params.position.y})
                //Выставляем активные параметры
                modalRef.style.width = params.width
                modalRef.style.height = params.height
                modalRef.style.resize = params.resize
                modalRef.style.borderTop = params.borderTop
                modalRef.style.borderRadius = params.radius
              }
            }}><i class="fa-regular fa-square"/>
          </button>}
          {modal().toolbar.close && <button title="Закрыть" onClick={async (e) => {
            //Закрываем окно, если активна стандартная обработка закрытия
            if (modalRef && (typeof modal().toolbar.close === "boolean" && modal().toolbar.close)) modalRef.remove()
            //Получаем пользовательское событие кнопки закрытия
            const holder = modal().toolbar.close as Required<JSX.CustomEventHandlersCamelCase<HTMLButtonElement>>["onClick"]
            //Если передана функция как аргумент - вызываем универсально с обработкой ошибок
            if (typeof holder === "function") await Promise.resolve(holder(e)).catch(error => console.error("Error in close handler:", error))
          }} class="close"><i class="fa-solid fa-x"/></button>}
        </div>}
      </div>
    })()}
    {(() => {
      //Возвращаем диалоговое окно
      switch(props.type ?? "div") {
        //Диалоговое окно - контейнер
        case "div": return <div class={props.class ? `modal ${props.class}` : "modal"} {...Object.fromEntries(Object.entries(props).filter(([key]) => key in ({} as JSX.HTMLAttributes<HTMLDivElement>)))} title={undefined}>
          {props.children}
        </div>
        //Диалоговое окно - форма
        case "form": return <form class={props.class ? `modal ${props.class}` : "modal"} {...Object.fromEntries(Object.entries(props).filter(([key]) => key in ({} as JSX.HTMLAttributes<HTMLFormElement>)))} title={undefined}>
          {props.children}
        </form>
        //Диалоговое окно - секция
        case "section": return <section class={props.class ? `modal ${props.class}` : "modal"} {...Object.fromEntries(Object.entries(props).filter(([key]) => key in ({} as JSX.HTMLAttributes<HTMLElement>)))} title={undefined}>
          {props.children}
        </section>
      }
    })()}
  </div>
}