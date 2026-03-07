use serde::{Deserialize, Serialize};
use sysinfo::{System, Networks, Disks};
use std::sync::Mutex;
use tauri::{State, AppHandle, Manager, Emitter};
use tauri_plugin_shell::ShellExt;
use notify::{Watcher, RecursiveMode, Config};
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CpuInfo {
    pub name: String,
    pub usage: f32,
    pub frequency: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GpuInfo {
    pub name: String,
    pub usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub temperature: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub cpus: Vec<CpuInfo>,
    pub gpus: Vec<GpuInfo>,
    pub disk_read: u64,
    pub disk_write: u64,
    pub net_recv: u64,
    pub net_sent: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub user: String,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub status: String,
    pub exe_path: String,
    pub parent_pid: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileChangeEvent {
    pub path: String,
    pub kind: String,
}


pub struct SystemState {
    pub sys: Mutex<System>,
    pub networks: Mutex<Networks>,
    pub disks: Mutex<Disks>,
}

pub struct BackendState {
    pub sidecar_id: Mutex<Option<u32>>,
    pub is_running: Mutex<bool>,
}

pub struct WatcherState {
    pub watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

#[tauri::command]
fn get_system_stats(state: State<SystemState>) -> SystemStats {
    let mut sys = state.sys.lock().unwrap();
    let mut networks = state.networks.lock().unwrap();
    let mut disks = state.disks.lock().unwrap();
    
    sys.refresh_cpu();
    sys.refresh_memory();
    networks.refresh_list();
    networks.refresh();
    disks.refresh_list();
    disks.refresh();

    let cpus = sys.cpus().iter().map(|cpu| CpuInfo {
        name: cpu.name().to_string(),
        usage: cpu.cpu_usage(),
        frequency: cpu.frequency(),
    }).collect();

    let gpus = get_nvidia_stats();

    // Calculate total disk read/write (Note: sysinfo 0.30 Disk doesn't have throughput directly)
    let disk_read = 0;
    let disk_write = 0;

    // Network usage
    let mut net_recv = 0;
    let mut net_sent = 0;
    for (_interface_name, data) in networks.iter() {
        net_recv += data.received();
        net_sent += data.transmitted();
    }

    SystemStats {
        cpu_usage: sys.global_cpu_info().cpu_usage(),
        memory_used: sys.used_memory(),
        memory_total: sys.total_memory(),
        swap_used: sys.used_swap(),
        swap_total: sys.total_swap(),
        cpus,
        gpus,
        disk_read,
        disk_write,
        net_recv,
        net_sent,
    }
}

#[tauri::command]
fn get_process_list(state: State<SystemState>) -> Vec<ProcessInfo> {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_processes();

    sys.processes().iter().map(|(pid, process)| ProcessInfo {
        pid: pid.as_u32(),
        name: process.name().to_string(),
        user: "".to_string(),
        cpu_usage: process.cpu_usage(),
        memory_usage: process.memory(),
        status: format!("{:?}", process.status()),
        exe_path: process.exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
        parent_pid: process.parent().map(|p| p.as_u32()),
    }).collect()
}

#[tauri::command]
async fn shell_execute(command: String, cwd: Option<String>) -> Result<String, String> {
    use std::process::Command;
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(&["/C", &command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(&["-c", &command]);
        c
    };

    if let Some(cwd_path) = cwd {
        cmd.current_dir(cwd_path);
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(stderr)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PlatformInfo {
    pub platform: String,
    pub release: String,
    pub os_type: String,
    pub homedir: String,
    pub shell: String,
    pub profile_path: String,
    pub profile_type: String,
}

fn get_linux_distro() -> String {
    if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
        for line in content.lines() {
            if line.starts_with("ID=") {
                return line.replace("ID=", "").replace("\"", "").to_lowercase();
            }
        }
    }
    "unknown".to_string()
}

#[tauri::command]
fn get_platform_info() -> Result<PlatformInfo, String> {
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_default();
    let platform = std::env::consts::OS.to_string();
    
    let shell = std::env::var("SHELL").unwrap_or_else(|_| {
        if platform == "windows" {
            "powershell".to_string()
        } else {
            "sh".to_string()
        }
    });

    let shell_lower = shell.to_lowercase();
    let (profile_path, profile_type) = if shell_lower.contains("zsh") {
        (format!("{}/.zshrc", home), "zsh".to_string())
    } else if shell_lower.contains("bash") {
        if platform == "macos" && std::path::Path::new(&format!("{}/.bash_profile", home)).exists() {
            (format!("{}/.bash_profile", home), "bash".to_string())
        } else {
            (format!("{}/.bashrc", home), "bash".to_string())
        }
    } else if shell_lower.contains("fish") {
        (format!("{}/.config/fish/config.fish", home), "fish".to_string())
    } else if shell_lower.contains("pwsh") || shell_lower.contains("powershell") {
        if platform == "windows" {
            (format!("{}/Documents/PowerShell/Microsoft.PowerShell_profile.ps1", home), "powershell".to_string())
        } else {
            (format!("{}/.config/powershell/Microsoft.PowerShell_profile.ps1", home), "powershell".to_string())
        }
    } else if shell_lower.contains("cmd") {
        (format!("{}/elara_env.cmd", home), "cmd".to_string())
    } else {
        // Fallback
        if platform == "windows" {
            (format!("{}/Documents/PowerShell/Microsoft.PowerShell_profile.ps1", home), "powershell".to_string())
        } else if platform == "macos" {
            (format!("{}/.zshrc", home), "zsh".to_string())
        } else {
            (format!("{}/.bashrc", home), "bash".to_string())
        }
    };

    let mut release = String::new();
    if platform == "linux" {
        release = get_linux_distro();
    }

    Ok(PlatformInfo {
        platform,
        release,
        os_type: std::env::consts::FAMILY.to_string(),
        homedir: home,
        shell,
        profile_path,
        profile_type,
    })
}

#[tauri::command]
fn read_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    // Note: blocking_pick_folder is part of the FileDialogBuilder trait
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    Ok(folder.and_then(|p| p.as_path().map(|path| path.to_string_lossy().to_string())))
}

#[tauri::command]
fn save_env_to_system(env_vars: std::collections::HashMap<String, String>) -> Result<String, String> {
    use std::io::{Read, Write};
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).map_err(|_| "Could not find home directory")?;
    let platform = std::env::consts::OS;
    
    let profile_path = if platform == "windows" {
        format!("{}\\Documents\\PowerShell\\Microsoft.PowerShell_profile.ps1", home)
    } else if platform == "macos" {
        format!("{}/.zshrc", home)
    } else {
        format!("{}/.bashrc", home)
    };

    let marker_start = "# === ELARA CLAUDE CODE ENV START ===\n";
    let marker_end = "# === ELARA CLAUDE CODE ENV END ===\n";
    
    let mut content = String::new();
    if std::path::Path::new(&profile_path).exists() {
        let mut file = std::fs::File::open(&profile_path).map_err(|e| e.to_string())?;
        file.read_to_string(&mut content).map_err(|e| e.to_string())?;
    }

    let mut new_env_block = String::from(marker_start);
    for (key, value) in env_vars {
        if platform == "windows" {
            new_env_block.push_str(&format!("$env:{} = \"{}\"\n", key, value));
        } else {
            new_env_block.push_str(&format!("export {}=\"{}\"\n", key, value));
        }
    }
    new_env_block.push_str(marker_end);

    let final_content = if let (Some(start), Some(end)) = (content.find(marker_start), content.find(marker_end)) {
        format!("{}{}{}", &content[..start], new_env_block, &content[end + marker_end.len()..])
    } else {
        format!("{}\n\n{}", content.trim_end(), new_env_block)
    };

    std::fs::write(&profile_path, final_content).map_err(|e| e.to_string())?;
    
    Ok(profile_path)
}

#[tauri::command]
async fn search_files(path: String, regex: String, pattern: Option<String>) -> Result<String, String> {
    use std::process::Command;
    let mut cmd = Command::new("grep");
    cmd.arg("-rE");
    cmd.arg(&regex);
    cmd.arg(&path);
    if let Some(p) = pattern {
        cmd.arg(format!("--include={}", p));
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    
    if output.status.success() || output.status.code() == Some(1) {
        Ok(stdout.trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
async fn ide_open_window(folder_path: String) -> Result<(), String> {
    use std::process::Command;
    
    // Try Zed first
    if Command::new("zed").arg(&folder_path).spawn().is_ok() {
        return Ok(());
    }
    
    // Try VS Code
    if Command::new("code").arg(&folder_path).spawn().is_ok() {
        return Ok(());
    }

    // Fallback to system opener
    #[cfg(target_os = "macos")]
    Command::new("open").arg(&folder_path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    Command::new("xdg-open").arg(&folder_path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    Command::new("explorer").arg(&folder_path).spawn().map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn list_files(path: String, recursive: bool) -> Result<Vec<String>, String> {
    let mut results = Vec::new();
    fn walk(dir: &std::path::Path, recursive: bool, depth: usize, results: &mut Vec<String>) -> std::io::Result<()> {
        if depth > 3 { return Ok(()); }
        if dir.is_dir() {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                
                if name == "node_modules" || name == ".git" || name == "dist" || name == "build" {
                    continue;
                }

                let path_str = path.to_string_lossy().to_string();
                if path.is_dir() {
                    results.push(format!("{}/", path_str));
                    if recursive {
                        let _ = walk(&path, recursive, depth + 1, results);
                    }
                } else {
                    results.push(path_str);
                }
                if results.len() > 500 { break; }
            }
        }
        Ok(())
    }
    
    let path_obj = std::path::Path::new(&path);
    walk(path_obj, recursive, 0, &mut results).map_err(|e| e.to_string())?;
    Ok(results)
}

#[tauri::command]
async fn server_start(port: u16, state: State<'_, BackendState>) -> Result<String, String> {
    let mut running = state.is_running.lock().unwrap();
    if *running {
        return Ok("Server already running".to_string());
    }

    // Check if port is already in use
    use std::net::TcpListener;
    if TcpListener::bind(format!("127.0.0.1:{}", port)).is_err() {
        return Err(format!("Port {} is already in use by another process", port));
    }

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = std::process::Command::new("cmd");
        c.args(&["/C", "elara-server", "-p", &port.to_string()]);
        c
    } else {
        let mut c = std::process::Command::new("elara-server");
        c.arg("-p");
        c.arg(port.to_string());
        c
    };

    println!("[Tauri] Attempting to start server on port: {}", port);
    let child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to start elara-server: {}. Please install it via 'npm install -g @khanhromvn/elara-server'",
            e
        )
    })?;

    let pid = child.id();
    *state.sidecar_id.lock().unwrap() = Some(pid);
    *running = true;

    Ok(format!("Started backend with PID: {}", pid))
}

#[tauri::command]
async fn server_stop(state: State<'_, BackendState>) -> Result<String, String> {
    let mut running = state.is_running.lock().unwrap();
    if !*running {
        return Ok("Server not running".to_string());
    }

    let mut id_lock = state.sidecar_id.lock().unwrap();
    if let Some(pid) = *id_lock {
        // Simple kill for now, could be improved
        #[cfg(unix)]
        {
            use std::process::Command;
            let _ = Command::new("kill").arg(pid.to_string()).status();
        }
        #[cfg(windows)]
        {
            use std::process::Command;
            let _ = Command::new("taskkill").args(&["/F", "/PID", &pid.to_string()]).status();
        }
    }
    
    *id_lock = None;
    *running = false;
    Ok("Server stopped".to_string())
}

#[tauri::command]
fn server_get_status(state: State<'_, BackendState>) -> bool {
    *state.is_running.lock().unwrap()
}

#[tauri::command]
fn watch_dir(app: AppHandle, state: State<'_, WatcherState>, path: String) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().unwrap();
    
    // Stop previous watcher if any
    if watcher_lock.is_some() {
        *watcher_lock = None;
    }

    let app_handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();

    let mut watcher = notify::RecommendedWatcher::new(tx, Config::default()).map_err(|e| e.to_string())?;

    watcher.watch(Path::new(&path), RecursiveMode::Recursive).map_err(|e| e.to_string())?;

    *watcher_lock = Some(watcher);

    tauri::async_runtime::spawn(async move {
        for res in rx {
            match res {
                Ok(event) => {
                    let paths: Vec<String> = event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
                    for path in paths {
                        let _ = app_handle.emit("file-changed", FileChangeEvent {
                            path,
                            kind: format!("{:?}", event.kind),
                        });
                    }
                }
                Err(e) => eprintln!("watch error: {:?}", e),
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn unwatch_dir(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().unwrap();
    *watcher_lock = None;
    Ok(())
}

fn get_nvidia_stats() -> Vec<GpuInfo> {
    use nvml_wrapper::Nvml;
    let mut stats = Vec::new();
    if let Ok(nvml) = Nvml::init() {
        if let Ok(count) = nvml.device_count() {
            for i in 0..count {
                if let Ok(device) = nvml.device_by_index(i) {
                    let name = device.name().unwrap_or_else(|_| "NVIDIA GPU".to_string());
                    let util = device.utilization_rates().map(|u| u.gpu as f32).unwrap_or(0.0);
                    let mem = device.memory_info();
                    let (used, total) = mem.map(|m| (m.used, m.total)).unwrap_or((0, 0));
                    let temp = device.temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu).unwrap_or(0);
                    stats.push(GpuInfo {
                        name,
                        usage: util,
                        memory_used: used,
                        memory_total: total,
                        temperature: temp,
                    });
                }
            }
        }
    }
    stats
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SystemState {
            sys: Mutex::new(System::new_all()),
            networks: Mutex::new(Networks::new_with_refreshed_list()),
            disks: Mutex::new(Disks::new_with_refreshed_list()),
        })
        .manage(BackendState {
            sidecar_id: Mutex::new(None),
            is_running: Mutex::new(false),
        })
        .manage(WatcherState {
            watcher: Mutex::new(None),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main").map(|w| {
                let _ = w.show();
                let _ = w.set_focus();
            });
        }))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{TrayIconBuilder, TrayIconEvent};

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_directory,
            save_env_to_system,
            get_platform_info,
            search_files,
            ide_open_window,
            list_files,
            server_start,
            server_stop,
            server_get_status,
            watch_dir,
            unwatch_dir,
            shell_execute,
            get_system_stats,
            get_process_list
        ])
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
