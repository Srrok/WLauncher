//Библиотеки
import { openUrl } from "@tauri-apps/plugin-opener"
import { JSX } from "solid-js"

//Стили компонента
import "./styles/index.scss"

//Компонент заголовка
export default function Footer(props: {children?: JSX.Element}): JSX.Element {
  //Получаем домен
  const domain = (() => {
    //Получаем исходный домен
    const domain = import.meta.env.PUBLIC_DOMAIN ? `${import.meta.env.PUBLIC_DOMAIN}` : undefined
    //Вставляем протокол, если не был обнаружен изначально
    return domain ? ((domain.startsWith("https://") || domain.startsWith("http://")) ? domain : `https://${domain}`) : undefined
  })()
  
  //Возвращаем разметку
  return <footer>
    <section>
      
    </section>
    <section>
      {domain ? <a title="Перейти на сайт" onclick={async () => await openUrl(domain)}>МГЕ © {(new Date()).getFullYear()}</a> : <p>МГЕ © {(new Date()).getFullYear()}</p>}
    </section>
  </footer>
}