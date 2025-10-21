//Библиотеки
use tauri::Manager;
use std::mem;

//Импорты для Windows
#[cfg(target_os = "windows")]
use windows::{
    Win32::Foundation::RECT,
    Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETWORKAREA},
};

//Импорты для macOS
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel};

//Импорты для Linux
#[cfg(target_os = "linux")]
use std::process::Command;

//Конфигурация приложения
#[cfg_attr(mobile, tauri::mobile_entry_point)]
//Команда закрытия
#[tauri::command]
async fn exit() {
    //Закрываем процесс
    std::process::exit(0);
}

//Запуск процесса
#[tauri::command]
async fn spawn(window: tauri::Window, path: String, header_height: Option<u32>, footer_height: Option<u32>) -> Result<u32, String> {
    //Для Windows, Linux и MacOS
    #[cfg(any(target_os = "windows", target_os = "linux", target_os = "macos"))]
    {
        //Библиотеки
        use std::process::Command;
        use std::thread;
        use std::time::Duration;
        //Создаём новый процесс
        let child = Command::new(&path).spawn().map_err(|e| format!("Failed to spawn process: {}", e))?;
        let child_pid = child.id();
        //Для MacOS
        #[cfg(target_os = "macos")]
        {
            //Результат
            Ok(child_pid)
        }
        //Для Linux
        #[cfg(target_os = "linux")]
        {
            //Результат
            Ok(child_pid)
        }
        //Для Windows
        #[cfg(target_os = "windows")]
        {
            //Ждем некоторое время для запуска процесса
            thread::sleep(Duration::from_millis(1000));
            //Получаем HWND окна Tauri
            let hwnd = window.hwnd().map_err(|e| format!("Failed to get window handle: {}", e))?;
            let parent_hwnd = hwnd.0 as winapi::shared::windef::HWND;
            //Игнор безопасности
            unsafe {
                //Библиотеки
                use winapi::um::winuser::{EnumWindows, GetWindowThreadProcessId, SetParent, IsWindowVisible, SetWindowPos, GetWindowLongPtrW, SetWindowLongPtrW, GetClientRect, MoveWindow};
                use winapi::um::winuser::{SWP_NOACTIVATE, SWP_FRAMECHANGED, SWP_NOZORDER};
                use winapi::um::winuser::{GWL_STYLE, WS_CAPTION, WS_THICKFRAME, WS_POPUP};
                use winapi::shared::minwindef::{BOOL, DWORD, LPARAM};
                use winapi::shared::basetsd::LONG_PTR;
                use winapi::shared::windef::RECT;
                //Структура для передачи данных
                struct EnumData {
                    target_pid: u32,
                    found_hwnd: winapi::shared::windef::HWND,
                }
                //Callback функция для перечисления окон
                extern "system" fn enum_windows_proc(hwnd: winapi::shared::windef::HWND, lparam: LPARAM) -> BOOL {
                    unsafe {
                        //Доступные HWND параметры окон
                        let enum_data = &mut *(lparam as *mut EnumData);
                        //Получаем PID окна
                        let mut window_pid: DWORD = 0;
                        GetWindowThreadProcessId(hwnd, &mut window_pid);
                        //Проверяем, что окно видимое и принадлежит целевому процессу
                        if window_pid == enum_data.target_pid && IsWindowVisible(hwnd) != 0 {
                          //Получаем HWND окна
                          enum_data.found_hwnd = hwnd;
                          //Возвращаем ответ
                          return 0;
                        }
                        1
                    }
                }
                //Данные о HWND процессах
                let mut enum_data = EnumData {target_pid: child_pid, found_hwnd: std::ptr::null_mut()};
                //Перечисляем все окна для поиска окна нашего процесса
                EnumWindows(Some(enum_windows_proc), &mut enum_data as *mut _ as LPARAM);
                //Если нашли окно процесса
                if !enum_data.found_hwnd.is_null() {
                    //Получаем размеры клиентской области Tauri окна
                    let mut rect: RECT = std::mem::zeroed();
                    //Получаем коллайдер Tauri окна
                    GetClientRect(parent_hwnd, &mut rect);
                    //Получаем итоговые размеры окна
                    let width = rect.right - rect.left;
                    let total_height = rect.bottom - rect.top;
                    //Рассчитываем высоту с учетом заголовков
                    let header_h = header_height.unwrap_or(0) as i32;
                    let footer_h = footer_height.unwrap_or(0) as i32;
                    let content_height = total_height - header_h - footer_h;
                    let y_offset = header_h;
                    //Получаем текущие стили
                    let style = GetWindowLongPtrW(enum_data.found_hwnd, GWL_STYLE);
                    //Выставляем размеры окна
                    SetWindowLongPtrW(enum_data.found_hwnd, GWL_STYLE, style & !(WS_CAPTION | WS_THICKFRAME | WS_POPUP) as LONG_PTR);
                    //Устанавливаем родителя
                    SetParent(enum_data.found_hwnd, parent_hwnd);
                    //Используем точное позиционирование и измененяем размер
                    MoveWindow(enum_data.found_hwnd, -2, y_offset, width + 4, content_height, 1);
                    //Принудительно обновляем окно
                    SetWindowPos(enum_data.found_hwnd, std::ptr::null_mut(), -2, y_offset, width + 4, content_height, SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_NOZORDER);
                    //Создаем безопасные копии HWND для передачи в поток
                    let child_hwnd = enum_data.found_hwnd as isize;
                    let parent_hwnd_copy = parent_hwnd as isize;
                    let header_final = header_h;
                    let footer_final = footer_h;
                    //Запускаем фоновый поток
                    std::thread::spawn(move || {
                        //Получаем предыдущие значения
                        let mut previous_size = (width, total_height);
                        //Цикл
                        loop {
                            //Задержка перед вычислением
                            thread::sleep(Duration::from_millis(1));
                            //Восстанавливаем HWND из isize
                            let child_hwnd = child_hwnd as winapi::shared::windef::HWND;
                            let parent_hwnd = parent_hwnd_copy as winapi::shared::windef::HWND;
                            //Получаем коллайдер родительского окна
                            let mut current_rect: RECT = std::mem::zeroed();
                            GetClientRect(parent_hwnd, &mut current_rect);
                            let current_width = current_rect.right - current_rect.left;
                            let current_total_height = current_rect.bottom - current_rect.top;
                            //Если размер изменился
                            if current_width != previous_size.0 || current_total_height != previous_size.1 {
                                //Получаем актуальные размеры
                                let current_content_height = current_total_height - header_final - footer_final;
                                let current_y_offset = header_final;
                                //Позиционируем окно с расширением на 100% ширины
                                MoveWindow(child_hwnd, -2, current_y_offset, current_width + 4, current_content_height, 1);
                                previous_size = (current_width, current_total_height);
                            }
                        }
                    });
                } else {
                    //Пока не найдем HWND
                    loop {
                        //Задержка перед проверкой
                        thread::sleep(Duration::from_millis(500));
                        //Получаем данные HWND процесса повторно
                        let mut retry_data = EnumData {
                            target_pid: child_pid,
                            found_hwnd: std::ptr::null_mut(),
                        };
                        //Вносим данные в процесс
                        EnumWindows(Some(enum_windows_proc), &mut retry_data as *mut _ as LPARAM);
                        //Если данные были найдены
                        if !retry_data.found_hwnd.is_null() {
                            //Получаем размеры клиентской области Tauri окна
                            let mut rect: RECT = std::mem::zeroed();
                            //Получаем коллайдер Tauri окна
                            GetClientRect(parent_hwnd, &mut rect);
                            //Получаем итоговые размеры окна
                            let width = rect.right - rect.left;
                            let total_height = rect.bottom - rect.top;
                            //Рассчитываем высоту с учетом заголовков
                            let header_h = header_height.unwrap_or(0) as i32;
                            let footer_h = footer_height.unwrap_or(0) as i32;
                            let content_height = total_height - header_h - footer_h;
                            let y_offset = header_h;
                            //Получаем текущие стили
                            let style = GetWindowLongPtrW(retry_data.found_hwnd, GWL_STYLE);
                            //Выставляем размеры окна
                            SetWindowLongPtrW(retry_data.found_hwnd, GWL_STYLE, style & !(WS_CAPTION | WS_THICKFRAME | WS_POPUP) as LONG_PTR);
                            //Устанавливаем родителя
                            SetParent(retry_data.found_hwnd, parent_hwnd);
                            //Используем точное позиционирование и измененяем размер
                            MoveWindow(retry_data.found_hwnd, -2, y_offset, width + 4, content_height, 1);
                            //Принудительно обновляем окно
                            SetWindowPos(retry_data.found_hwnd, std::ptr::null_mut(), -2, y_offset, width + 4, content_height, SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_NOZORDER);
                            //Создаем безопасные копии HWND для передачи в поток
                            let child_hwnd = retry_data.found_hwnd as isize;
                            let parent_hwnd_copy = parent_hwnd as isize;
                            let header_final = header_h;
                            let footer_final = footer_h;
                            //Запускаем фоновый поток
                            std::thread::spawn(move || {
                                //Получаем предыдущие значения
                                let mut previous_size = (width, total_height);
                                //Цикл
                                loop {
                                    //Задержка перед вычислением
                                    thread::sleep(Duration::from_millis(1));
                                    //Восстанавливаем HWND из isize
                                    let child_hwnd = child_hwnd as winapi::shared::windef::HWND;
                                    let parent_hwnd = parent_hwnd_copy as winapi::shared::windef::HWND;
                                    //Получаем коллайдер родительского окна
                                    let mut current_rect: RECT = std::mem::zeroed();
                                    GetClientRect(parent_hwnd, &mut current_rect);
                                    let current_width = current_rect.right - current_rect.left;
                                    let current_total_height = current_rect.bottom - current_rect.top;
                                    //Если размер изменился
                                    if current_width != previous_size.0 || current_total_height != previous_size.1 {
                                        //Получаем актуальные размеры
                                        let current_content_height = current_total_height - header_final - footer_final;
                                        let current_y_offset = header_final;
                                        //Позиционируем окно с расширением на 100% ширины
                                        MoveWindow(child_hwnd, -2, current_y_offset, current_width + 4, current_content_height, 1);
                                        previous_size = (current_width, current_total_height);
                                    }
                                }
                            });
                            //Выходим
                            break;
                        }
                    }
                }
            }
        }
        //Результат
        Ok(child_pid)
    }
    //Для Android систем
    #[cfg(target_os = "android")]
    {
        //Результат
        Ok(child_pid)
    }
}

#[tauri::command]
fn kill_process(pid: u32) -> bool {
    //Для Windows
    #[cfg(target_os = "windows")]
    {
        //Библиотеки
        use winapi::um::processthreadsapi::{OpenProcess, TerminateProcess};
        use winapi::um::winnt::PROCESS_TERMINATE;
        use winapi::um::handleapi::CloseHandle;
        //Игнор безопасности
        unsafe {
            //Получаем процесс по PID
            let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
            //Если процесс не найден
            if handle.is_null() {
                //Возвращаем ответ
                return false;
            }
            //Уничтожаем процесс
            let result = TerminateProcess(handle, 0);
            //Закрываем обработчик
            CloseHandle(handle);
            //Результат
            result != 0
        }
    }

    //Для Unix-систем
    #[cfg(unix)]
    {
        //Библиотеки
        use std::process::Command;
        //Завершаем процесс по PID
        let status = Command::new("kill").arg(pid.to_string()).status().map(|status| status.success()).unwrap_or(false);
        //Результат
        status
    }
}

//Проверка процесса
#[tauri::command]
fn process_running(pid: u32) -> bool {
    //Для Windows
    #[cfg(target_os = "windows")]
    {
        //Библиотеки
        use winapi::um::processthreadsapi::OpenProcess;
        use winapi::um::winnt::PROCESS_QUERY_INFORMATION;
        use winapi::um::handleapi::CloseHandle;
        //Игнор безопасности
        unsafe {
            //Получаем информацию о процессе
            let handle = OpenProcess(PROCESS_QUERY_INFORMATION, 0, pid);
            //Если процесса нет
            if handle.is_null() {
                //Возвращаем ответ
                return false;
            }
            //Закрываем обработчик
            CloseHandle(handle);
            //Ответ
            true
        }
    }
    //Для Unix-систем
    #[cfg(unix)]
    {
        //Библиотеки
        use std::process::Command;
        //Получаем информацию о процессе
        let output = Command::new("ps").arg("-p").arg(pid.to_string()).output();
        //Проверяем, запущен ли процесс
        match output {Ok(output) => output.status.success(), Err(_) => false}
    }
}

//Получение размеров монитора
#[tauri::command]
async fn monitor_size(app_handle: tauri::AppHandle) -> Result<(u32, u32), String> {
    //Получаем текущее окно
    let window = app_handle.get_webview_window("main").unwrap();
    //Получаем текущий монитор
    let monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get current monitor: {}", e))?
        .ok_or("No monitor found".to_string())?;
    //Получаем размеры монитора
    let size = monitor.size();
    let (mut width, mut height) = (size.width, size.height);

    //Динамическое определение Windows
    #[cfg(target_os = "windows")]
    unsafe {
        //Получаем рабочую область
        let mut work_area: RECT = mem::zeroed();
        let result = SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            Some(&mut work_area as *mut _ as _),
            windows::Win32::UI::WindowsAndMessaging::SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        );
        //Если есть результат
        if result.is_ok() {
            //Возвращаем ответ с учётом таскбара
            width = (work_area.right - work_area.left) as u32;
            height = (work_area.bottom - work_area.top) as u32;
        }
    }

    //Динамическое определение MacOS
    #[cfg(target_os = "macos")]
    unsafe {
        //Получаем рабочую область
        let screen_class = class!(NSScreen);
        let screens: *mut objc::runtime::Object = msg_send![screen_class, mainScreen];
        //Если есть рабочая область
        if !screens.is_null() {
            //Получаем рамку рабочей области
            let frame: cocoa::foundation::NSRect = msg_send![screens, visibleFrame];
            //Возвращаем ответ с учётом таскбара
            width = frame.size.width as u32;
            height = frame.size.height as u32;
        }
    }

    //Динамическое определение Linux
    #[cfg(target_os = "linux")]
    {
        //Если есть рабочая область
        if let Ok(work_area) = get_linux_work_area() {
            //Возвращаем ответ с учётом таскбара
            width = work_area.0;
            height = work_area.1;
        }
    }

    //Возвращаем результат
    Ok((width, height))
}

//Получение рабочей области Linux
#[cfg(target_os = "linux")]
fn get_linux_work_area() -> Result<(u32, u32), Box<dyn std::error::Error>> {
    //Стандартная обработка области
    if let Ok(area) = get_work_area_xprop() {
        //Возвращаем ответ
        return Ok(area);
    }
    //Для GNOME среды
    if let Ok(area) = get_work_area_gsettings() {
        //Возвращаем ответ
        return Ok(area);
    }
    //Выбрасываем ошибку
    Err("Couldn't identify the workspace".into())
}

//Стандартное получение области Linux
#[cfg(target_os = "linux")]
fn get_work_area_xprop() -> Result<(u32, u32), Box<dyn std::error::Error>> {
    //Запрашиваем CLI интерфейс
    let output = Command::new("xprop")
        .args(&["-root", "-notype", "_NET_WORKAREA"])
        .output()?;
    //Если ответ получен
    if output.status.success() {
        //Получаем консольный вывод
        let stdout = String::from_utf8(output.stdout)?;
        //Если форма ответа корректна
        if let Some(start) = stdout.find('=') {
            //Парсинг ответа от консольного интерфейса
            let values: Vec<&str> = stdout[start + 1..].split(',').collect();
            //Если длинна корректна
            if values.len() >= 4 {
                //Получаем рабочую область
                let width = values[2].trim().parse::<u32>()?;
                let height = values[3].trim().parse::<u32>()?;
                //Возвращаем ответ
                return Ok((width, height));
            }
        }
    }

    //Выбрасываем ошибку
    Err("Failed to get the workspace via xprop".into())
}

//Получение параметров Linux
#[cfg(target_os = "linux")]
fn get_work_area_gsettings() -> Result<(u32, u32), Box<dyn std::error::Error>> {
    //Запрашиваем CLI интерфейс
    let output = Command::new("xrandr").args(&["--current"]).output()?;
    //Если ответ получен
    if output.status.success() {
        //Получаем консольный вывод
        let stdout = String::from_utf8(output.stdout)?;
        //Итерация по линиям ответа
        for line in stdout.lines() {
            //Если линия содержит сообщение об успехе
            if line.contains(" connected ") && line.contains('+') {
                //Если есть результат
                if let Some(res) = line.split_whitespace().find(|s| s.contains('x')) {
                    //Разбиваем по частям
                    let parts: Vec<&str> = res.split('x').collect();
                    //Если длинна корректна
                    if parts.len() == 2 {
                        //Получаем рабочую область
                        let width = parts[0].parse::<u32>().unwrap_or(1920);
                        let height = parts[1].parse::<u32>().unwrap_or(1080);
                        //Возвращаем ответ
                        return Ok((width, height.saturating_sub(40)));
                    }
                }
            }
        }
    }
    //Выбрасываем ошибку
    Err("Failed to retrieve information via xrandr".into())
}

//При запуске
pub fn run() {
    //Собираем Tauri приложение
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![exit, monitor_size, spawn, process_running, kill_process])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
