//Библиотеки
use tauri::Manager;
use std::mem;

//Импорты для Windows
#[cfg(target_os = "windows")]
use windows::{
  Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETWORKAREA},
  Win32::Foundation::RECT,
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

//Получение размеров монитора
#[tauri::command]
async fn monitor_size(app_handle: tauri::AppHandle) -> Result<(u32, u32), String> {
  //Получаем текущее окно
  let window = app_handle.get_webview_window("main").unwrap();
  //Получаем текущий монитор  
  let monitor = window.current_monitor()
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
      SPI_GETWORKAREA, 0, Some(&mut work_area as *mut _ as _), windows::Win32::UI::WindowsAndMessaging::SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0)
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
      let values: Vec<&str> = stdout[start+1..].split(',').collect();
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
  let output = Command::new("xrandr")
    .args(&["--current"])
    .output()?;
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
    .plugin(tauri_plugin_log::Builder::new().build())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_autostart::Builder::new().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![exit, monitor_size])
    .run(tauri::generate_context!())
    .expect("error while running tauri application")
}