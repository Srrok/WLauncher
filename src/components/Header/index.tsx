//Библиотеки
import { createSignal, JSX, onMount } from "solid-js"
import { getLabel } from "../.."

//Стили компонента
import "./styles/index.scss"

//Компонент кнопки меню
export const Button = (props: {id?: string, icon?: string, class?: string, action?: (event: MouseEvent) => void, children?: string, isClose?: boolean}): JSX.Element => 
<button {...(props.id && {id: props.id})} {...(props.children && {title: props.children})} {...(props.action && {onclick: (e) => setTimeout(() => props.action?.(e), 100)})} {...(props.isClose && {class: "close"})}>
  <i {...(props.isClose && {style: "color: var(--close_button_color);"})} {...(props.icon && {class: props.icon})}/>
</button>

//Компонент заголовка
export default function Header(props: {additionalMenu?: JSX.Element, children?: JSX.Element}): JSX.Element {
  //Название приложения
  const [label, setLabel] = createSignal<string>("WLauncher")
  //Донатный баланс
  const [balance, setBalance] = createSignal<number>(0)

  //При инициализации
  onMount(async () => {
    //Устанавливаем название приложения
    setLabel(await getLabel())
  })

  //Возвращаем разметку
  return <>
    <header data-tauri-drag-region>
      <div data-tauri-drag-region class="label">
        <img data-tauri-drag-region class="logo" src="icon.png" alt="WLauncher Logo"/>
        <h1 data-tauri-drag-region><span data-tauri-drag-region>{label()[0]}</span>{label().slice(1)}</h1>
      </div>
      <div data-tauri-drag-region class="menu">
        {props.children}
      </div>
    </header>
    {props.additionalMenu && <section class="toolbar">
      <div class="info">
        <i class="fa-solid fa-sack-dollar"/>
        <p>Баланс: {new Intl.NumberFormat("ru-RU", {style: "currency", currency: "RUB"}).format(balance())}</p>
      </div>
      <div class="menu">
        {props.additionalMenu}
      </div>
    </section>}
  </>
}