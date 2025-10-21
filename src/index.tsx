//Библиотеки
import { exists, create, remove, mkdir, readTextFile, readDir} from "@tauri-apps/plugin-fs"
import { createEffect, createSignal, JSX, onMount, Suspense, onCleanup } from "solid-js"
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state"
import { setIntervalAsync, clearIntervalAsync } from "set-interval-async"
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
import Modal, { Alert, ModalField, ModalRow } from "./components/Dialog"
import Footer from "./components/Footer"

//Тип темы приложения
export type Theme = "light" | "dark"

//Инициализация валидатора типов
const ajv = new Ajv({allErrors: true})

//Форматирование чисел в компактный вид
const numberFormater = new Intl.NumberFormat("en-US", {notation: "compact", maximumFractionDigits: 1})

//Функция получения имени приложения
export const getLabel = async () => (await app.getName()).toLowerCase().split("").map((char, index) => index < 2 ? char.toUpperCase() : char).join("")

//Функция для создания типизированных валидаторов
export function createValidator<T>(schema: object): ValidateFunction<T> {return ajv.compile<T>(schema)}

//Схема для типа темы
export const themeSchema = createValidator<Theme>({type: "string", enum: ["light", "dark"]})

//Тип параметров приложения
export type Settings = {
  theme: Theme,
  fullscreen: boolean,
  games: Array<{
    path: string,
    fullscreen?: boolean
  }>
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
    games: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: {type: "string"},
          fullscreen: {type: "boolean"}
        },
        required: ["path"],
        additionalProperties: false
      }
    },
    keybinds: {
      type: "array",
      items: {
        type: "object",
        properties: {
          event: {type: "string"},
          key: {type: "string"}
        },
        required: ["event", "key"],
        additionalProperties: false
      }
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
export const getConfig = async (config: Settings = {theme: "dark", fullscreen: false, games: [], keybinds: getKeybinds()}) => {
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
  //Параметры игр
  const [games, setGames] = createSignal<Settings["games"]>([])
  //Назначения клавиш
  const [keybinds, setKeybinds] = createSignal<Required<Settings>["keybinds"]>(getKeybinds())
  //Регионы перетаскивания окна
  const [draggable, setDraggable] = createSignal<Element[]>([])
  //Состояние запущенности игры
  const [gameStarted, setGameStarted] = createSignal<number | undefined>(undefined)
  //Ссылка на главный элемент и элемент списка
  let listRef: HTMLDivElement | undefined
  let mainRef: HTMLElement | undefined
  //Блокировщики спама полным экраном
  let isHandlingResize: boolean = false

  /* СЛИТЬ ВОЕДИНО В user, setUser типа string с цифровой подписью JWT токены вместо ответа */
  //Права администратора
  const [isAdmin, setAdmin] = createSignal<boolean>(false)
  //Состояние авторизации
  const [isAuth, setAuth] = createSignal<boolean>(true)
  /*========================================================================================*/

  //Функция максимизации окна
  const maximize = async (props: boolean | {width: number, height: number}) => {
    //Блокируем повторное использование
    isHandlingResize = true
    //Определяем режим полного экрана и параметры
    const fullscreen = typeof props === "boolean" ? props : (await invoke<Array<number>>("monitor_size")).every((max, i) => max <= [props.width, props.height][i])
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
    active.listen("tauri://resize", async ({payload}) => {if (!isHandlingResize) await maximize(payload as any)})
    //При запросе на закрытие
    active.onCloseRequested(async (e) => {
      //Прерываем обработку
      e.preventDefault()
      //Если запущена игра
      if (gameStarted()) {
        //Убиваем процесс, если возможно
        const result = await (async () => {try {return await invoke<boolean>("kill_process", {pid: gameStarted()})} catch (error) {return false}})()
        //Если результата нет - выбрасываем предупреждение
        if (!result) console.warn(`Process with PID ${gameStarted()} was not destroyed!`)
      }
      //Попытка обработки
      try {
        //Попытка создать рабочую директорию
        try {await mkdir(await path.resourceDir())} catch(e) {}
        //Удаляем предыдущий файл, если существует
        try {await remove(import.meta.env.PUBLIC_CONFIG_FILE, {baseDir: path.BaseDirectory.Resource})} catch(e) {}
        //Сохраняем параметры текущего сеанса
        await create(import.meta.env.PUBLIC_CONFIG_FILE, {baseDir: path.BaseDirectory.Resource}).then(async (file) => {
          //Записываем контент файла
          await file.write(new TextEncoder().encode(JSON.stringify({
            theme: theme(),
            games: games(),
            keybinds: keybinds(),
            fullscreen: fullscreen()
          } as Settings, null, 2)))
          //Закрываем файл
          await file.close()
        })
      } catch (e) {
        //Выбрасываем ошибку в консоль
        console.error(`Can"t use current filesystem! Cause: ${e}`)
      }
      //Сохраняем состояние окна лаунчера
      await saveWindowState(StateFlags.DECORATIONS | StateFlags.SIZE | StateFlags.POSITION)
      //Закрываем окно
      await invoke("exit")
    })
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
    //Получаем игры
    setGames(config.games)
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
    //Если есть список
    if (listRef) {
      //Список серверов
      const servers = Array.from(listRef.children as HTMLCollectionOf<HTMLDivElement>)
      //Получаем ширину максимально широкого заголовка серверного элемента из всех в списке в пикселях
      const width = `${Math.max(...servers.map(server => server.querySelector('div.header')?.getBoundingClientRect().width || 0))}px`
      //Выставляем общую ширину для всех элементов заголовка в серверном списке
      servers.forEach(element => element.querySelector<HTMLDivElement>('div.header')!.style.minWidth = width)
    }
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
    //Если задана ссылка на объект, игра не запущена и есть задние фоны - устанавливаем фон
    if (mainRef && !gameStarted() && backgrounds().length > 0) mainRef.style.backgroundImage = `url(${backgrounds()[[
      ...Array(backgrounds().length).keys()].filter(i => i !== bgIndex() - 1)[Math.floor(Math.random() * (backgrounds().length - 1))]
    ]})`
  })

  //Эффект смены темы - устанавливаем полученную тему оформления
  createEffect(() => document.documentElement.setAttribute("data-theme", theme()))

  //При запуске игры меняем прозрачность родительского элемента
  createEffect(() => {if (mainRef) {if (gameStarted()) {mainRef.classList.add("transparent")} else mainRef.classList.remove("transparent")}})

  //Компонент отображения сервера
  const ServerListItem = (props: {
    game: string,
    path: string,
    icon?: string,
    version: string,
    children: string,
    online: {current: number, maximum: number},
    system?: Array<"windows" | "linux" | "android" | "wearos" | "ios" | "macos">
  }) => {
    //Ссылки на кнопку и иконку
    let button: HTMLButtonElement | undefined
    let icon: HTMLDivElement | undefined

    //При монтировании
    onMount(() => {
      //Если нет кнопки или иконки - выходим
      if (!button || !icon) return undefined
      //Выставляем размеры изображения по размерам кнопки
      icon.style.width = `${button.getBoundingClientRect().height}px`
      icon.style.height = `${button.getBoundingClientRect().height}px`
    })

    //Разметка компонента
    return <div class="list-item">
      <div class="img" style={{"background-image": `url(${props.icon ?? "icon.png"})`}} ref={icon}/>
      <div class="header">
        <h4>{props.children}</h4>
        <progress max={props.online.maximum} value={props.online.current}/>
        <div class="info">
          <p><i class="fa-solid fa-dice-d6"/>{props.game}</p>
          <p><i class="fa-solid fa-code-compare"/>{props.version}</p>
        </div>
      </div>
      <button ref={button} onClick={async () => {
        //Если нет компонента окна - выходим
        if (!mainRef) return undefined
        //Формируем путь к игре
        const game = `${`${await path.resourceDir()}\\games`}\\${props.path.replace(/^[/\\]/, "").replace("/", "\\")}`
        //Если директории игры не существует
        if (!await exists(game)) {
          /* СДЕЛАТЬ ПРОЦЕСС СКАЧИВАНИЯ СБОРКИ */
        }
        //Функция для проверки существования процесса
        const isProcessRunning = async (pid: number): Promise<boolean> => {
          //Возвращаем результат проверки процесса
          try {return await invoke<boolean>("process_running", {pid})} catch (error) {return false}
        }
        //Получаем отступы сверху и снизу
        const padding = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header_height').trim().replace("px", ""))
        //Получаем параметр полноэкранного режима
        const isFullscreen = games().find(item => item.path === game)?.fullscreen ?? false
        //Выставляем новые параметры
        setGames([...games(), {path: game, fullscreen: isFullscreen}])
        //Получаем PID процесса
        const pid = await (async () => {try {
          //Создаём процесс игры в лаунчере
          return await invoke<number>("spawn", {path: game, headerHeight: padding, footerHeight: padding})
        } catch (e) {
          //Информируем пользователя об ошибке
          console.error(`Can't start game process with ${game} because ${(e as any).message}`)
          //Возвращаем ошибку
          return undefined
        }})()
        //Если PID не был получен
        if (!pid) return undefined
        //Выставляем полноэкранный режим для игры, если не выставлен
        if (isFullscreen && !fullscreen()) maximize(true)
        //Выставляем флаг запуска
        setGameStarted(pid)
        //Создаём интервал обзвона процесса на предмет активности в случае, если игра запущена
        const checker = setIntervalAsync(async () => {const isRunning = await isProcessRunning(pid); if (gameStarted() && !isRunning) {
          //Отключаем процесс игры
          setGameStarted(undefined)
          //Удаляем таймер
          await clearIntervalAsync(checker)
        }}, 1)
      }}>
        <i class="fa-solid fa-play"/>
      </button>
    </div>
  }

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
      <HeaderButton icon="fa-solid fa-x" isClose={true} action={async () => await program().close()}>Закрыть</HeaderButton>
    </Header>
    {isAuth() ? <section id="game" class="main">
      {!gameStarted() && <Modal class="servers" window={{draggable: false, resizable: false, random: false, pinnable: false, toolbar: false}}>
        <section class="header">
          <i class="fa-solid fa-chess-rook"/>
          <h1>Игровые сервера</h1>
        </section>
        <section class="list" ref={listRef}>
          <ServerListItem game="Mindustry" path="/Mindustry/Mindustry.exe" version="Steam build 146" online={{current: 50, maximum: 100}}>Тестовый сервер</ServerListItem>
        </section>
        <section class="footer">
          <h3><i class="fa-solid fa-users"/>Общий онлайн: {numberFormater.format(123)}</h3>
          <h3><i class="fa-solid fa-user-secret"/>Онлайн админов: {numberFormater.format(123)}</h3>
          <h3><i class="fa-solid fa-bed"/>AFK онлайн: {numberFormater.format(123)}</h3>
        </section>
      </Modal>}
      <section id={import.meta.env.PUBLIC_ROOT_ELEMENT ?? "window"} class="workspace"/>
    </section> : <section id={import.meta.env.PUBLIC_ROOT_ELEMENT ?? "window"} class="auth">{(() => {
      //Сигнал состояния окна
      const [isAuth, setIsAuth] = createSignal<boolean>(true)
      //Сигнал состояния пароля
      const [isVisible, setIsVisible] = createSignal<boolean>(false)
      //Возвращаем разметку формы авторизации пользователя
      return <Modal title={isAuth() ? "Авторизация" : "Регистрация"} icon={isAuth() ? "fa-solid fa-user" : "fa-solid fa-user-plus"} type="form" window={{center: false, random: false, draggable: false, resizable: false, pinnable: false, toolbar: false}}>{isAuth() ? <>
        <ModalField maxlength={16} required>Логин</ModalField>
        <ModalField type="password" maxlength={32} required>Пароль</ModalField>
        <ModalRow>
          <ModalField kind="button" type="submit" icon="fa-solid fa-door-open">Войти</ModalField>
          <ModalField kind="button" onClick={() => setIsAuth(false)} icon="fa-solid fa-user-plus">Регистрация</ModalField>
        </ModalRow>
        <ModalField kind="button" icon="fa-solid fa-unlock">Забыл пароль</ModalField>
      </>: <>
        <ModalField maxlength={16} required>Логин</ModalField>
        <ModalRow>
          <ModalField kind="input" maxlength={254} type="email" required onInput={({target}) => {
            //Получаем противоположное поле
            const oposite = target.closest(".row")?.lastChild?.firstChild as HTMLInputElement
            //Выходим, если опозиционное поле заполнено
            if (oposite.value.trim().length > 0) return undefined
            //Регулируем обязательность номера телефона, если есть значение
            oposite.required = !(target.value.trim().length > 0)
            //Получаем флаг обязательности опозиционного поля
            const flag = oposite.parentElement?.querySelector<HTMLSpanElement>("div.focus > label > span")
            //Если флага нет - выходим
            if (!flag) return undefined
            //Переназначаем видимость
            flag.style.display = !(target.value.trim().length > 0) ? "inline" : "none"
          }}>E-Mail</ModalField>
          <ModalField kind="input" type="tel" required onInput={({target}) => {
            //Получаем противоположное поле
            const oposite = target.closest(".row")?.firstChild?.firstChild as HTMLInputElement
            //Выходим, если опозиционное поле заполнено
            if (oposite.value.trim().length > 0) return undefined
            //Регулируем обязательность поля E-Mail, если есть значение
            oposite.required = !(target.value.trim().length > 0)
            //Получаем флаг обязательности опозиционного поля
            const flag = oposite.parentElement?.querySelector<HTMLSpanElement>("div.focus > label > span")
            //Если флага нет - выходим
            if (!flag) return undefined
            //Переназначаем видимость
            flag.style.display = !(target.value.trim().length > 0) ? "inline" : "none"
          }}>Телефон</ModalField>
        </ModalRow>
        <ModalRow>
          <ModalField id="password" type="password" maxlength={32} required>Пароль</ModalField>
          <ModalField id="password-confirm" type="password" maxlength={32} required>Повторите</ModalField>
          <ModalField kind="button" icon={isVisible() ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"} title={isVisible() ? "Скрыть" : "Показать"} onClick={() => {
            //Извлекаем поля пароля и подтверждения пароля
            const [password, confirm] = Array.from(document.getElementById(import.meta.env.PUBLIC_ROOT_ELEMENT ?? "window")?.children[0].querySelector("form.modal")?.querySelectorAll<HTMLInputElement>("#password, #password-confirm") ?? [undefined, undefined])
            //Если компоненты не получены - выходим
            if (!password || !confirm) return
            //Выставляем видимость пароя
            setIsVisible(!isVisible())
            //Выставляем видимость пароля в обоих окнах
            password.type = isVisible() ? "input" : "password"
            confirm.type = isVisible() ? "input" : "password"
          }}></ModalField>
        </ModalRow>
        <ModalRow>
          <ModalField kind="button" type="submit" icon="fa-solid fa-door-open">Войти</ModalField>
          <ModalField kind="button" onClick={() => setIsAuth(true)} icon="fa-solid fa-user-plus">Авторизация</ModalField>
        </ModalRow>
      </>}</Modal>
    })()}</section>}
    {isAuth() && <Footer>
      
    </Footer>}
  </main>
}}/></Router>, document.getElementById("root") as HTMLElement)