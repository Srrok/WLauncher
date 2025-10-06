//Библиотеки
import { JSX, createSignal, onMount, onCleanup } from "solid-js"

//Стили диалогового окна
import "./styles/index.scss"

//Тип диалогового окна
export type DialogType = (JSX.HTMLAttributes<HTMLDivElement> | JSX.HTMLAttributes<HTMLFormElement> | JSX.HTMLAttributes<HTMLElement>) & {
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
    }
  }
} & ({title: string} & {icon?: string} | {title?: undefined} & {icon?: never})

//Тип координат
export type CoordinatesType = {x: number, y: number}

//Многоуровневая очистка типов от неопределённости
export type DeepRemoveUndefined<T> = T extends object ? {[K in keyof T]-?: Exclude<DeepRemoveUndefined<T[K]>, undefined>} : T

//Тип поля модального окна
export type ModalFieldType = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "children"> & {
  type?: Required<JSX.InputHTMLAttributes<HTMLInputElement>["type"]> | "textarea",
  children: string
}

//Тип поля ввода текста
type TextareaProps = {
  type?: never,
  children: string,
  kind?: "textarea"
} & Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "children">

//Тип поля ввода
type InputProps = {
  kind?: "input",
  children: string,
  type?: Required<JSX.InputHTMLAttributes<HTMLInputElement>["type"]>
} & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "children">

//Тип поля ввода
type ButtonProps = {
  icon?: string,
  kind?: "button",
  children: string,
  type?: Required<JSX.ButtonHTMLAttributes<HTMLButtonElement>["type"]>
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children">

//Поле ввода модального окна
export function ModalField(props: TextareaProps | InputProps | ButtonProps) {
  //Вставляем значение по умолчанию
  props.kind = props.kind ?? "input"
  //Функции - валидаторы
  const isInput = (props: TextareaProps | InputProps | ButtonProps): props is InputProps => {return props.kind === "input"}
  const isTextarea = (props: TextareaProps | InputProps | ButtonProps): props is TextareaProps => {return props.kind === "textarea"}
  //Возвращаем результат
  return <div>
    {isTextarea(props) ? <textarea {...{...props, children: undefined}} {...props.id && {id: props.id, name: props.id}} placeholder=" "/> : (isInput(props) ? 
    <input 
      {...props}
      placeholder=" "
      type={props.type ?? "text"}
      {...props.id && {id: props.id, name: props.id}}
      {...["submit", "reset", "button"].includes(props.type ?? "text") && {
        title: props.children,
        value: props.children,
        onMouseDown: (e) => {
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
        },
        onAnimationEnd: (e) => {
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
    /> : <button 
      {...props}
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
    >{props.icon && <i class={props.icon}/>}{props.children}</button>)}
    {(!["submit", "reset", "button"].includes(props.type ?? "text") && props.kind !== "button") && <>
      <div class="focus"/>
      <label for={props.id}>{props.children}</label>
    </>}
  </div>
}

//Компонент диалогового окна
export default function modal(props: DialogType) {
  //Состояние для позиции окна
  let modalRef: HTMLDivElement | undefined
  const [isPinned, setPinned] = createSignal<boolean>(false)
  const [isDragging, setIsDragging] = createSignal<boolean>(false)
  const [wasCentered, setWasCentered] = createSignal<boolean>(false)
  const [isFullscreen, setFullscreen] = createSignal<boolean>(false)
  const [position, setPosition] = createSignal<CoordinatesType>({x: 0, y: 0})
  const [dragOffset, setDragOffset] = createSignal<CoordinatesType>({x: 0, y: 0})
  const [modal, setModal] = createSignal<DeepRemoveUndefined<Required<DialogType>["window"]>>({
    resizable: props.window?.resizable ?? true,
    draggable: props.window?.draggable ?? true,
    pinnable: props.window?.pinnable ?? true,
    center: props.window?.center ?? false,
    toolbar: {
      close: props.window?.toolbar?.close ?? true,
      minimize: props.window?.toolbar?.minimize ?? true,
      maximize: props.window?.toolbar?.maximize ?? true
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
  
  //Получаем параметры окна по умолчанию
  const startup: DeepRemoveUndefined<Required<DialogType>["window"]> = {
    resizable: props.window?.resizable ?? true,
    draggable: props.window?.draggable ?? true,
    pinnable: props.window?.pinnable ?? true,
    center: props.window?.center ?? true,
    toolbar: {
      close: props.window?.toolbar?.close ?? true,
      minimize: props.window?.toolbar?.minimize ?? true,
      maximize: props.window?.toolbar?.maximize ?? true
    }
  }

  //Получение случайных координат к центру
  const getRandomPosition = (): CoordinatesType => {
    //Если нет модального окна - возвращаем ответ
    if (!modalRef) return {x: 0, y: 0}
    //Получаем родительский и собственный коллайдеры
    const modalRect = modalRef.getBoundingClientRect()
    const parentRect = modalRef.parentElement?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, left: 0, top: 0}
    //Возвращаем ответ
    return {
      x: Math.max(0, Math.min(((parentRect.width - modalRect.width) / 2) + ((Math.random() - 0.5) * parentRect.width * 0.3), parentRect.width - modalRect.width)),
      y: Math.max(0, Math.min(((parentRect.height - modalRect.height) / 2) + ((Math.random() - 0.5) * parentRect.height * 0.3), parentRect.height - modalRect.height))
    }
  }

  //Функция для центрирования окна
  const centerModal = () => {
    //Если нет окна - возвращаем
    if (!modalRef) return
    //Получаем родительский и собственный коллайдеры
    const modalRect = modalRef.getBoundingClientRect()
    const parentRect = modalRef.parentElement?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, left: 0, top: 0}
    //Устанавливаем позицию по центру для окна
    setPosition({x: (parentRect.width - modalRect.width) / 2, y: (parentRect.height - modalRect.height) / 2})
    //Окно было центрировано
    setWasCentered(true)
  }

  //При инициализации
  onMount(() => {
    //Если есть окно
    if (modalRef) {
      //Если есть разрешение
      if (modal().center) {
        //Центрируем окно
        centerModal()
      } else {
        //Устанавливаем случайную позицию
        setPosition(getRandomPosition())
      }
      //Если есть разрешение на изменение размеров
      if (modal().resizable) {
        //Слушатель изменения размеров
        const resizeObserver = new ResizeObserver(() => {
          //Если нет родителя - выходим
          if (!modalRef.parentElement) return
          //Отключаем наблюдатель воизбежание рекурсии
          resizeObserver.unobserve(modalRef)
          //Состояние обновления
          let needsUpdate = false
          //Получаем собственную нижнюю координату модального окна
          const bottom = modalRef.getBoundingClientRect().bottom
          //Получаем нижний элемент и его нижнюю координату
          const {lowestElement, maxBottom} = Array.from(modalRef.children).reduce((overallAcc: {lowestElement: Element | null, maxBottom: number}, childs: Element) => {
            //Получаем прошлый результат как объект
            const result = Array.from(childs.querySelectorAll('*')).reduce((acc: {lowestElement: Element | null, maxBottom: number}, element: Element) => {
              //Получаем дно коллайдера указанного элемента
              const bottom = element.getBoundingClientRect().bottom
              //Сравниваем с предыдущими, определяя минимальную координату
              return bottom > acc.maxBottom ? { lowestElement: element, maxBottom: bottom } : acc
            }, {lowestElement: null, maxBottom: -Infinity})
            //Сравниваем результат текущего объекта с прошлым
            return result.maxBottom > overallAcc.maxBottom ? result : overallAcc
          }, {lowestElement: null, maxBottom: -Infinity})
          //Если зафиксирован нижний элемент и его граница
          if (lowestElement && bottom - maxBottom <= 17) {
            //Принудительно фиксируем нижнюю границу
            modalRef.style.minHeight = `${modalRef.getBoundingClientRect().height}px`
            //Вызываем обновления
            needsUpdate = true
          }
          //Получаем коллайдеры родителя и элемента
          const parent = modalRef.parentElement.getBoundingClientRect()
          const element = modalRef.getBoundingClientRect()
          //Проверяем выход за границы по ширине
          if (element.width > parent.width) {
            //Устанавливаем максимальную ширину
            modalRef.style.maxWidth = `${parent.width}px`
            //Вызываем обновления
            needsUpdate = true
          } else if (modalRef.style.maxWidth) modalRef.style.maxWidth = ""
          //Проверяем выход за границы по высоте
          if (element.height > parent.height) {
            //Устанавливаем максимальную высоту
            modalRef.style.maxHeight = `${parent.height}px`
            //Вызываем обновления
            needsUpdate = true
          } else if (modalRef.style.maxHeight) modalRef.style.maxHeight = ""
          //Корректируем позицию если выходит за границы
          const { newHeight, newWidth } = Object.freeze({
            newHeight: element.bottom > parent.bottom ? element.height - (element.bottom - parent.bottom) : element.height,
            newWidth: element.right > parent.right ? element.width - (element.right - parent.right) : element.width
          })
          //Проверяем границы и вызываем обновления
          if (element.right > parent.right) needsUpdate = true
          if (element.bottom > parent.bottom) needsUpdate = true
          //Если разрешены обновления - вызываем обновления
          if (needsUpdate) requestAnimationFrame(() => {
            //Устанавливаем максимальную ширину и высоту по требованию
            if (newWidth !== element.width) modalRef.style.width = `${newWidth}px`
            if (newHeight !== element.height) modalRef.style.height = `${newHeight}px`
          })
          //Активируем наблюдение после небольшой задержки
          setTimeout(() => resizeObserver.observe(modalRef), 1)
        })
        //Привязываем обработчик расширения
        resizeObserver.observe(modalRef)
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
      setPosition({
        x: Math.max(0, Math.min(e.clientX - dragOffset().x - parentRect.left, parentRect.width - modalRect.width)),
        y: Math.max(0, Math.min(e.clientY - dragOffset().y - parentRect.top, parentRect.height - modalRect.height))
      })
    }
    
    //Событие зажатия мыши - переключение разрешения
    const handleMouseUp = () => setIsDragging(false)
    
    //Событие изменения размера окна
    const handleResize = () => {
      //Если не указано окно
      if (!modalRef) return
      //Получаем родительский и собственный коллайдеры
      const modalRect = modalRef.getBoundingClientRect()
      const parentRect = modalRef.parentElement?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, left: 0, top: 0}
      //Если окно было центрировано
      if (wasCentered()) {
        //Центрируем окно
        centerModal()
      } else {
        //Иначе просто проверяем границы
        let x: number = position().x
        let y: number = position().y
        //Если окно вышло за границу родительского окна по ширине - корректируем
        if (x + modalRect.width > parentRect.width) x = Math.max(0, parentRect.width - modalRect.width)
        //Если окно вышло за границу родительского окна по высоте - корректируем
        if (y + modalRect.height > parentRect.height) y = Math.max(0, parentRect.height - modalRect.height)
        //Если позиции отличаются от исходных - вносим результат валидирования
        if (x !== position().x || y !== position().y) setPosition({x, y})
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

  //Заголовок окна
  const Header = () => {
    //Возвращаем разметку
    return <div classList={{"modal-header": true, "dragging": isDragging()}} onMouseDown={(e: MouseEvent) => {
      //Получаем собственный HTML тег в нижнем регистре
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      //Условие для проверки на то, зажата ли кнопка
      const isButton = (["button", "i"].includes(tag) && ((e.target as HTMLElement).parentElement?.tagName.toLowerCase() ?? "button") === "button")
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
    }}>
      {(props.title && props.icon) || props.title ? <div>
        {props.icon && <i class={props.icon}/>}
        <h1>{props.title}</h1>
      </div> : <></>}
      {(modal().toolbar.minimize || modal().toolbar.maximize || modal().pinnable || modal().toolbar.close) && <div>
        {modal().pinnable && <button title={isPinned() ? "Открепить" : "Закрепить"} onClick={() => {
          //Меняем результат
          setPinned(!isPinned())
          //Если есть окно
          if (modalRef) {
            //Получаем сигнал закрепления
            const pinned = isPinned()
            //Если закреплено
            if (pinned) {
              //Устанавливаем свойства окна
              setWindowParams({
                width: modalRef.style.width,
                height: modalRef.style.height,
                resize: modalRef.style.resize,
                radius: modalRef.style.borderRadius,
                borderTop: modalRef.style.borderTop,
                position: {x: position().x, y: position().y}
              })
              //Отключаем свойства окна
              setModal({...modal(), resizable: false, draggable: false, toolbar: {close: false, minimize: false, maximize: false}})
              //Удаляем стили растягивания
              modalRef.style.resize = "none"
            } else {
              //Активируем свойства окна
              setModal(startup)
              //Получаем параметры окна
              const params = windowParams()
              //Если параметры заданы и есть разрешение - возвращаем свойство
              if (params && modal().resizable) modalRef.style.resize = params.resize
            }
          }
        }}><i 
          class={isPinned() ? "fa-solid fa-thumbtack-slash" : "fa-solid fa-thumbtack"}
        /></button>}
        {modal().toolbar.minimize && <button title="Свернуть"><i class="fa-solid fa-window-minimize"/></button>}
        {modal().toolbar.maximize && <button 
          title={isFullscreen() ? "Восстановить" : "Развернуть"}
          onClick={() => {
            //Если нет окна - выходим
            if (!modalRef) return
            //Меняем полноэкранный режим
            setFullscreen(!isFullscreen())
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
              //Перемещаем окно на исходную позицию
              setTimeout(() => setPosition({x: params.position.x, y: params.position.y}), 0)
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
  }

  //Стили для позиционирования окна
  const modalStyle = (): JSX.CSSProperties => ({transform: `translate(${position().x}px, ${position().y}px)`, position: "absolute", left: "0", top: "0"})

  //Возвращаем диалоговое окно
  switch(props.type ?? "div") {
    //Диалоговое окно - контейнер
    case "div": return <div ref={modalRef} class="modal-window" style={modalStyle()}>
      <Header/>
      <div class={props.class ? `modal ${props.class}` : "modal"} {...props as JSX.HTMLAttributes<HTMLDivElement>} title="">
        {props.children}
      </div>
    </div>
    //Диалоговое окно - форма
    case "form": return <div ref={modalRef} class="modal-window" style={modalStyle()}>
      <Header/>
      <form class={props.class ? `modal ${props.class}` : "modal"} {...props as JSX.HTMLAttributes<HTMLFormElement>} title="">
        {props.children}
      </form>
    </div>
    //Диалоговое окно - секция
    case "section": return <div ref={modalRef} class="modal-window" style={modalStyle()}>
      <Header/>
      <section class={props.class ? `modal ${props.class}` : "modal"} {...props as JSX.HTMLAttributes<HTMLElement>} title="">
        {props.children}
      </section>
    </div>
  }
}