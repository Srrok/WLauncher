//Библиотеки
import { render } from "solid-js/web"
import { JSX, onMount } from "solid-js"

//Стили компонента
import "./styles/index.scss"

//Тип уведомления
export type NotifyType = "info" | "success" | "notice" | "warning" | "error"

//Базовое уведомление
export const Notify = {
  //Базовый компонент
  Component: (props: {type?: NotifyType, children: string, timeout?: number}) => {
    //Ссылка на компонент
    let notifyRef: HTMLLabelElement | undefined
    //Ссылка на чекбокс
    let inputRef: HTMLInputElement | undefined
    //При монтировании устанавливаем таймер, если нужно
    onMount(() => {if (props.timeout) setTimeout(() => {
      //Если есть чекбокс
      if (inputRef) {
        //Блокируем изменения
        inputRef.disabled = true
        //Симулируем нажатие
        inputRef.checked = true
        //Если получена ссылка на компонент - удаляем с экрана
        if (notifyRef) setTimeout(() => {notifyRef.remove()}, 300)
      }
    }, props.timeout)})
    //Разметка компонента
    return <label ref={notifyRef} class="notify">
      <input ref={inputRef} type="checkbox" class="alertCheckbox" autocomplete="off" onClick={(e) => {
        //Блокируем повторное нажатие
        e.currentTarget.disabled = true
        //Если получена ссылка на компонент - удаляем с экрана
        if (notifyRef) setTimeout(() => {notifyRef.remove()}, 300)
      }}/>
      <div class={`alert ${props.type ?? "info"}`}>
        <span class="alertClose">X</span>
        <span class="alertText">
          {props.children}
          <br class="clear"/>
        </span>
      </div>
    </label>
  },
  
  //Функция демонстрации уведомления
  show: (message: string, props?: {type?: NotifyType, parent?: HTMLElement | JSX.Element, timeout?: number} & ({type: NotifyType} | {parent: HTMLElement | JSX.Element} | {timeout: number})) => {
    //Получаем родительский элемент
    const parent = props?.parent ?? document.getElementById(import.meta.env.PUBLIC_ROOT_ELEMENT ?? "window")
    //Получаем родительский элемент как контейнер
    const element = (parent instanceof HTMLElement ? parent : ((parent as any).props?.id ? document.getElementById((parent as any).props?.id) || document.body : document.body))
    //Рендерим JSX компонент в родительский контейнер
    const dispose = render(() => Notify.Component(props ? {...props, children: message} : {children: message}), element)
    //Возвращаем как DOM функцию
    return () => {dispose(); element.remove()}
  },
  
  //Вспомогательные методы для частых случаев
  success: (message: string, props?: {parent?: HTMLElement | JSX.Element, timeout?: number} & ({parent: HTMLElement | JSX.Element} | {timeout: number})) => Notify.show(message, {type: "success", ...(props?.timeout && {timeout: props.timeout}), ...(props?.parent && {parent: props.parent})}),
  notice: (message: string, props?: {parent?: HTMLElement | JSX.Element, timeout?: number} & ({parent: HTMLElement | JSX.Element} | {timeout: number})) => Notify.show(message, {type: "notice", ...(props?.timeout && {timeout: props.timeout}), ...(props?.parent && {parent: props.parent})}),
  warn: (message: string, props?: {parent?: HTMLElement | JSX.Element, timeout?: number} & ({parent: HTMLElement | JSX.Element} | {timeout: number})) => Notify.show(message, {type: "warning", ...(props?.timeout && {timeout: props.timeout}), ...(props?.parent && {parent: props.parent})}),
  error: (message: string, props?: {parent?: HTMLElement | JSX.Element, timeout?: number} & ({parent: HTMLElement | JSX.Element} | {timeout: number})) => Notify.show(message, {type: "error", ...(props?.timeout && {timeout: props.timeout}), ...(props?.parent && {parent: props.parent})}),
  info: (message: string, props?: {parent?: HTMLElement | JSX.Element, timeout?: number} & ({parent: HTMLElement | JSX.Element} | {timeout: number})) => Notify.show(message, {type: "info", ...(props?.timeout && {timeout: props.timeout}), ...(props?.parent && {parent: props.parent})})
}