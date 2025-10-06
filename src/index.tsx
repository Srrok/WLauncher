//Библиотеки
import { exists, create, remove, mkdir, readTextFile, readDir} from "@tauri-apps/plugin-fs"
import { createEffect, createSignal, JSX, onMount, Suspense, onCleanup } from "solid-js"
import { revealItemInDir as explorer} from "@tauri-apps/plugin-opener"
import { getCurrentWindow as program } from "@tauri-apps/api/window"
import { hexToCSSFilter as hexToFilter } from "hex-to-css-filter"
import { relaunch } from "@tauri-apps/plugin-process"
import { check } from "@tauri-apps/plugin-updater"
import { Route, Router } from "@solidjs/router"
import { invoke } from "@tauri-apps/api/core"
import Ajv, { ValidateFunction } from "ajv"
import { path } from "@tauri-apps/api"
import { render } from "solid-js/web"
import { app } from "@tauri-apps/api"

//Основные стили приложения
import "./styles/app.scss"

//Компоненты
import Header, { Button as HeaderButton } from "./components/Header"
import Modal, { ModalField } from "./components/Dialog"
import Footer from "./components/Footer"

//Тип темы приложения
export type Theme = "light" | "dark"

//Инициализация валидатора типов
const ajv = new Ajv({allErrors: true})

//Функция получения имени приложения
export const getLabel = async () => (await app.getName()).toLowerCase().split("").map((char, index) => index < 2 ? char.toUpperCase() : char).join("")

//Функция для создания типизированных валидаторов
export function createValidator<T>(schema: object): ValidateFunction<T> {return ajv.compile<T>(schema)}

//Схема для типа темы
export const themeSchema = createValidator<Theme>({type: "string", enum: ["light", "dark"]})

//Тип параметров приложения
export type Settings = {
  theme: Theme,
  fullscreen: boolean
  keybinds: Array<{
    event: string,
    key: string
  }>
}

//Схема для типа параметров
export const configSchema = createValidator<Settings>({
  type: "object",
  properties: {
    theme: {type: "string", enum: ["light", "dark"]},
    fullscreen: {type: "boolean"},
    keybinds: {
      type: "object",
      properties: {
        event: {type: "string"},
        key: {type: "string"}
      },
      required: ["event", "key"],
      additionalProperties: false
    }
  },
  required: ["theme", "fullscreen"],
  additionalProperties: false
})

//Клавиши управления по умолчанию
export const getKeybinds = () => Object.entries(import.meta.env).filter(([k, v]) => k.startsWith("PUBLIC_KEY_") && typeof v === "string" && (() => {
  //Проверка на валидность указанного ключа при фильтрации клавиш
  try {new KeyboardEvent("keydown", {code: v}); return true} catch {return false}
})()).map(([k, v]) => ({event: k.replace("PUBLIC_KEY_", "").toLowerCase(), key: v as string}))

//Получение конфигурации
export const getConfig = async (config: Settings = {theme: "dark", fullscreen: false, keybinds: getKeybinds()}) => {
  //Если параметры не были сохранены - возвращаем параметры по умолчанию
  if (!await exists(await path.join(await path.resourceDir(), import.meta.env.PUBLIC_CONFIG_FILE))) return config
  //Читаем исходный файл параметров
  const result: Record<string, any> = await (async () => {try {
    //Возвращаем обработанный результат
    return JSON.parse(await readTextFile(import.meta.env.PUBLIC_CONFIG_FILE, {baseDir: path.BaseDirectory.Resource}))
  } catch(e) {return undefined}})()
  //Если результата нет или он не валидирован - возвращаем ответ
  if (!result || !configSchema(result)) return config
  //Возвращаем ответ
  return result
}

//Рендеринг клиентской части приложения
render(() => <Router root={(props) => <Suspense fallback={((): JSX.Element => {
  //Название приложения
  const [label, setLabel] = createSignal<string>("WLauncher")
  //Цвет темы
  const [theme, setTheme] = createSignal<string>("#000")

  //Получение переменной из стилей
  const getVariable = (variable: string) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim()

  //При инициализации
  onMount(async () => {
    //Получаем название приложения
    setLabel(await getLabel())
    //Устанавливаем полученную тему оформления из конфигурации
    document.documentElement.setAttribute("data-theme", (await getConfig()).theme)
    //Устанавливаем тему
    setTheme(getVariable("--main_loading_color"))
    //Наблюдатель мутаций темы HTML доумента
    const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => {if (mutation.attributeName === "data-theme") setTheme(getVariable("--main_color"))}))
    //Подключаем наблюдатель к HTML документу
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]})
    //При очистке отключаем наблюдатель
    onCleanup(() => observer.disconnect())
  })

  //При установке названия меняем название окна
  createEffect(() => document.getElementsByTagName("title")[0].textContent = label())

  //Возвращаем разметку
  return <div data-tauri-drag-region class="loading">
    <div data-tauri-drag-region aria-busy={true} class="container">
      <img style={{filter: hexToFilter(theme()).filter}} data-tauri-drag-region class="logo" aria-busy={true} src="/icon_face.svg" alt={label()}/>
      <div data-tauri-drag-region class="label" aria-busy={true}>{label()}</div>
    </div>
  </div>
})()}>{props.children}</Suspense>}><Route path="/" component={() => {
  //Холдер задних фонов
  const [backgrounds, setBackgrounds] = createSignal<string[]>([])
  //Текущий индекс фона
  const [bgIndex, setBgIndex] = createSignal<number>(0)
  //Состояние полноэкранного режима
  const [fullscreen, setFullscreen] = createSignal<boolean>(false)
  //Исходные параметры окна
  const [borders, setBorders] = createSignal<{radius: string, border: string}>({radius: "0px", border: "none"})
  //Тема приложения
  const [theme, setTheme] = createSignal<Theme>("dark")
  //Имя приложения
  const [label, setLabel] = createSignal<string>("WLauncher")
  //Состояние вспомогательного меню
  const [additionalMenu, setAdditionalMenu] = createSignal<boolean>(false)
  //Назначения клавиш
  const [keybinds, setKeybinds] = createSignal<Required<Settings>["keybinds"]>(getKeybinds())
  //Регионы перетаскивания окна
  const [draggable, setDraggable] = createSignal<Element[]>([])
  //Ссылка на элемент main
  let mainRef: HTMLElement | undefined
  //Блокировщики спама полным экраном
  let isHandlingResize: boolean = false

  /* СЛИТЬ ВОЕДИНО В user, setUser типа string с цифровой подписью JWT токены вместо ответа */
  //Права администратора
  const [isAdmin, setAdmin] = createSignal<boolean>(false)
  //Состояние авторизации
  const [isAuth, setAuth] = createSignal<boolean>(false)
  /*========================================================================================*/

  //Функция максимизации окна
  const maximize = async (props: boolean | {width: number, height: number}) => {
    //Блокируем повторное использование
    isHandlingResize = true
    //Определяем режим полного экрана и параметры
    const fullscreen = typeof props === "boolean" ? props : (await invoke("monitor_size") as Array<number>).every((max, i) => max <= [props.width, props.height][i])
    //Получаем активное окно
    const current = await program()
    //Устанавливаем режим окна
    setFullscreen(fullscreen)
    //Если полный экран - отменяем скругление и окантовку окна, иначе применяем
    document.getElementsByTagName("main")[0].style.borderRadius = fullscreen ? "0" : borders().radius
    document.getElementsByTagName("main")[0].style.border = fullscreen ? "none" : borders().border
    //Если полный экран
    if (fullscreen) {
      //Запоминаем регионы перетаскивания окна в сигнал
      setDraggable([...document.querySelectorAll("[data-tauri-drag-region]")])
      //Итерация с удалением по регионам перетаскивания
      draggable().forEach(el => el.removeAttribute("data-tauri-drag-region"))
    } else {
      //Итерация с добавлением по регионам перетаскивания
      draggable().forEach(el => {if (el && el.isConnected) el.setAttribute("data-tauri-drag-region", "")})
    }
    //Если полноэкранный режим активирован не по кнопке
    if (fullscreen && typeof props !== "boolean") current.unmaximize()
    //Устанавливаем полноэкранный режим
    await current.setFullscreen(fullscreen)
    //Фокусируемся на окне лаунчера
    if (fullscreen) await current.setFocus()
    //Устанавливаем приоритет окна
    await current.setAlwaysOnTop(fullscreen)
    //Разблокируем повторное использование
    isHandlingResize = false
  }

  //При инициализации
  onMount(async () => {
    //Активное окно
    const active = program()
    //Привязываем обработчик максимального растягивания окна
    active.listen("tauri://resize", async ({payload}) => {if (!isHandlingResize) {
      //Вызываем метод расширения экрана
      await maximize(payload as any)
    }})
    //Получаем исходное скругление окна
    setBorders({radius: document.getElementsByTagName("main")[0].style.borderRadius, border: document.getElementsByTagName("main")[0].style.border})
    //Получаем массив задних фонов
    setBackgrounds(Object.keys(import.meta.glob("/public/backgrounds/*", {eager: false})).map(path => path.replace("/public/", "")))
    //Устанавливаем имя приложения
    setLabel(await getLabel())
    //Получаем параметры настроек
    const config = await getConfig()
    //Устанавливаем тему
    setTheme(config.theme)
    //Устанавливаем полноэкранный режим
    setFullscreen(config.fullscreen)
    //Запускаем интервал смены фонов
    const interval = setInterval(() => {
      //Если задние фоны присутствуют - задаём новый случайный индекс
      if (backgrounds().length > 0) setBgIndex(prev => (prev + 1) % backgrounds().length)
    }, (() => {try {return parseInt(import.meta.env.PUBLIC_BACKGROUND_TIME)} catch(e) {
      //Выбрасываем ошибку, если получено не число
      throw new Error("Can't use not number value in background timer event!")
    }})())
    //Применяем слушатель нажатия клавиш
    document.addEventListener("keyup", async (event) => {
      //Прерываем стандартную обработку
      event.preventDefault()
      //Получаем доступные ключи
      const keys = keybinds()
      //Получаем доступные события по нажатой клавише
      const events = keys.filter(item => item.key === event.code).map(item => item.event)
      //Если есть активные события
      if (events.length > 0) await Promise.all(events.map(async event => {switch(event) {
        //Событие переключения полного экрана
        case "fullscreen":
          //Меняем оконный режим
          maximize(!fullscreen())
          //Выходим
          break
        //Событие переключения темы
        case "theme": 
          //Меняем тему окна
          setTheme(theme() === "dark" ? "light" : "dark")
          //Выходим
          break
      }}))
    })
    //Очищаем интервал при размонтировании
    onCleanup(() => clearInterval(interval))
  })

  //При установке названия меняем название окна
  createEffect(() => document.getElementsByTagName("title")[0].textContent = label())

  //При взаимодействии с тулбаром
  createEffect(() => {
    //Получаем параметры тулбара
    const isMenuOpen = additionalMenu()
    //Получаем тулбар и кнопку
    const toolbar = document.querySelector("main section.toolbar") as HTMLElement | null
    const button = document.getElementById("additional-menu")
    //Если тулбара нет
    if (!toolbar || !button) {
      //Выбрасываем ошибку
      console.error("Can't find toolbar component or button to open that component!")
      //Возвращаем результат
      return undefined
    }
    //Оригинальный размер тулбара
    let originalHeight = toolbar.offsetHeight
    //Инициализация
    toolbar.style.overflow = "hidden"
    toolbar.style.transition = "all 0.3s ease"
    //Если меню открыто
    if (isMenuOpen) {
      //Устанавливаем высоту
      toolbar.style.height = "0px"
      //Устанавливаем прозрачность
      toolbar.style.opacity = "0"
      //Запрашиваем анимацию
      requestAnimationFrame(() => {toolbar.style.height = `${originalHeight}px`, toolbar.style.opacity = "1"})
      //Добавляем обработчик клика вне тулбара
      const handleClickOutside = (event: MouseEvent) => {if (isMenuOpen && (!toolbar.contains(event.target as Node) && !button.contains(event.target as Node))) setAdditionalMenu(false)}
      //Добавляем обработчик с задержкой на клик вне тулбара
      setTimeout(() => document.addEventListener("click", handleClickOutside), 50)
      //Убираем обработчик при очистке на клик вне тулбара
      onCleanup(() => document.removeEventListener("click", handleClickOutside))
    } else {
      //Устанавливаем высоту
      toolbar.style.height = `${toolbar.offsetHeight}px`
      //Запрашиваем анимацию
      requestAnimationFrame(() => {toolbar.style.height = "0px", toolbar.style.opacity = "0"})
    }
    //Счётчик анимации открытия с предотвращением быстрого нажатия
    setTimeout(() => {if (isMenuOpen) toolbar.style.height = ""}, 50)
    //Вращаем иконку кнопки переключения
    button.getElementsByTagName("i")[0].style.transform = isMenuOpen ? "rotate(180deg)" : "rotate(0deg)"
  })

  //Эффект для смены фона
  createEffect(() => {
    //Если задана ссылка на объект и есть задние фоны - устанавливаем фон
    if (mainRef && backgrounds().length > 0) mainRef.style.backgroundImage = `url(${backgrounds()[[
      ...Array(backgrounds().length).keys()].filter(i => i !== bgIndex() - 1)[Math.floor(Math.random() * (backgrounds().length - 1))]
    ]})`
  })

  //Эффект смены темы - устанавливаем полученную тему оформления
  createEffect(() => document.documentElement.setAttribute("data-theme", theme()))

  //Возвращаем разметку
  return <main ref={mainRef}>
    <Header additionalMenu={isAuth() && <>
      <HeaderButton icon={"fa-solid fa-camera"} action={() => {}}>Записи и скриншоты</HeaderButton>
      <HeaderButton icon={"fa-solid fa-shop"} action={() => {}}>Магазин</HeaderButton>
      {isAdmin() && <HeaderButton icon={"fa-solid fa-screwdriver-wrench"} action={() => {}}>Панель администратора</HeaderButton>}
      <HeaderButton icon={"fa-solid fa-folder"} action={async () =>
        //Открываем директорию приложения
        await explorer(`${await path.resourceDir()}/${(await readDir(await path.resourceDir()))[0].name}`)
      }>Проводник</HeaderButton>
      <HeaderButton icon={"fa-solid fa-window-restore"} action={() => {}}>Оконный менеджер</HeaderButton>
      <HeaderButton icon={"fa-solid fa-cog"} action={() => {}}>Параметры</HeaderButton>
      <HeaderButton icon={"fa-solid fa-download"} action={() => {}}>Обновить клиент</HeaderButton>
    </>}>
      {isAuth() && <HeaderButton id="additional-menu" icon={"fa-solid fa-angle-down"} action={async () => setAdditionalMenu(!additionalMenu())}>Вспомогательное меню</HeaderButton>}
      <HeaderButton icon={theme() === "light" ? "fa-solid fa-moon" : "fa-solid fa-sun"} action={async () => setTheme(theme() === "light" ? "dark" : "light")}>
        {`${theme() === "light" ? "Тёмная" : "Светлая"} тема`}
      </HeaderButton>
      <HeaderButton icon="fa-solid fa-window-minimize" action={async () => await program().minimize()}>Свернуть</HeaderButton>
      <HeaderButton icon="fa-regular fa-square" action={async () => maximize(!fullscreen())}>{fullscreen() ? "Восстановить" : "Развернуть"}</HeaderButton>
      <HeaderButton icon="fa-solid fa-x" isClose={true} action={async () => {
        try {
          //Попытка создать рабочую директорию
          try {await mkdir(await path.resourceDir())} catch(e) {}
          //Удаляем предыдущий файл, если существует
          try {await remove(import.meta.env.PUBLIC_CONFIG_FILE, {baseDir: path.BaseDirectory.Resource})} catch(e) {}
          //Сохраняем параметры текущего сеанса
          await create(import.meta.env.PUBLIC_CONFIG_FILE, {baseDir: path.BaseDirectory.Resource}).then(async (file) => {
            //Записываем контент файла
            await file.write(new TextEncoder().encode(JSON.stringify({theme: theme(), keybinds: keybinds(), fullscreen: fullscreen()} as Settings, null, 2)))
            //Закрываем файл
            await file.close()
          })
        } catch (e) {
          //Выбрасываем ошибку
          throw new Error(`Can"t use current filesystem! Cause: ${e}`)
        }
        //Завершаем работу
        await invoke("exit")
      }}>Закрыть</HeaderButton>
    </Header>
    {isAuth() ? <section class="main">
      
    </section> : <section class="auth">
      <Modal title="Регистрация" icon="fa-solid fa-user-pen" type="form" onSubmit={(e: SubmitEvent) => {
        //Прерываем обработку
        e.preventDefault()
      }}>
        
      </Modal>
    </section>}
    {isAuth() && <Footer>
      
    </Footer>}
  </main>
}}/></Router>, document.getElementById("root") as HTMLElement)
/*
  СДЕЛАТЬ СОХРАНЕНИЕ ПОЗИЦИИ ЗАКРЕПЛЁННЫХ МОДАЛЬНЫХ ОКОН ПРИ ЗАКРЫТИИ ПРИЛОЖЕНИЯ
  <ModalField id="textarea" kind="textarea" required>Ввод текста</ModalField>
  <ModalField id="check" type="checkbox" required>Чекбокс</ModalField>
  <ModalField id="color" type="color" required>Цвет</ModalField>
  <ModalField id="date" type="date" required>Дата</ModalField>
  <ModalField id="datetime-local" type="datetime-local" required>Время</ModalField>
  <ModalField id="file" type="file" required>Файл</ModalField>
  <ModalField id="image" type="image" required>Изображение</ModalField>
  <ModalField id="month" type="month" required>Месяц</ModalField>
  <ModalField id="number" type="number" required>Число</ModalField>
  <ModalField id="range" type="range" required>Диапазон</ModalField>
  <ModalField id="search" type="search" required>Поиск</ModalField>
  <ModalField id="time" type="time" required>Время</ModalField>
  <ModalField id="week" type="week" required>Неделя</ModalField>
*/