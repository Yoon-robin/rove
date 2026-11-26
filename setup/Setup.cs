// RoveSetup.exe: puts Rove on this PC the way install.cmd does, in a window of its own.
// GitHub release (Yoon-robin/rove) latest.json -> the zip, sha256 checked while it comes in ->
// %LOCALAPPDATA%\Rove\app-<version> -> the junction current -> shortcuts. From then on Rove
// updates itself (update.cjs, which also checks the release key's signature).
// No admin rights: the manifest says asInvoker (a name with "setup" in it would otherwise
// make Windows ask for them).
//
// Built by setup/build.cjs with the C# compiler that ships with Windows (.NET Framework 4.x).
// Kept to C# 5: that compiler knows no newer language.
//
// --uninstall (Windows' installed apps runs it, from current\RoveSetup.exe): the same window
// takes Rove off again. It first copies itself to %TEMP% so the folder it ran from can go.
//
// For tests only: --home <dir> installs there instead (and leaves Windows' list alone),
// --no-links leaves the shortcuts,
// --links-to <dir> makes them in <dir>\Desktop and <dir>\Programs,
// --no-open leaves Rove off, --go starts at once and quits at the end (exit code 1 on a failure),
// --shot <png> [--state <s>] draws the window to a file and quits.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using Path = System.IO.Path;
using SPath = System.Windows.Shapes.Path;

[assembly: AssemblyTitle("Rove 설치")]
[assembly: AssemblyProduct("Rove")]
[assembly: AssemblyCompany("yoonrobin.xyz")]
[assembly: AssemblyCopyright("GPL-3.0, Yoon-robin")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

static class Setup
{
    const string Base = "https://github.com/Yoon-robin/rove/releases/latest/download/";
    static readonly Regex Safe = new Regex(@"^[0-9A-Za-z][\w.-]{0,79}$");
    static readonly Regex Hex64 = new Regex("^[0-9a-f]{64}$");

    static Window win;
    static string home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Rove");
    static bool links = true, goNow, openAfter = true;
    // removing: --uninstall; listed: Windows' installed apps is this install's (not a test's --home)
    static bool removing, listed = true, moved;
    static int after;   // the copy waits for the RoveSetup.exe it was started by (it sits in the folder)
    const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Rove";
    static string version, file, sha256, linksTo;
    static long size;
    static CancellationTokenSource stop;
    static bool busy, done;
    static readonly List<Step> steps = new List<Step>();

    // the side column's rows: each step of the install, lit while it runs
    class Step
    {
        public Border Row; public SPath Icon; public TextBlock Name; public string Shape;
    }

    static T Part<T>(string name) where T : class { return (T)win.FindName(name); }
    static Brush Res(string key) { return (Brush)win.Resources[key]; }

    [STAThread]
    static int Main(string[] args)
    {
        string shot = null, state = null;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--home" && i + 1 < args.Length) { home = Path.GetFullPath(args[++i]); listed = false; }
            else if (args[i] == "--from" && i + 1 < args.Length) { home = Path.GetFullPath(args[++i]); moved = true; }
            else if (args[i] == "--uninstall") removing = true;
            else if (args[i] == "--after" && i + 1 < args.Length) int.TryParse(args[++i], out after);
            else if (args[i] == "--no-links") links = false;
            else if (args[i] == "--links-to" && i + 1 < args.Length) linksTo = Path.GetFullPath(args[++i]);
            else if (args[i] == "--go") goNow = true;
            else if (args[i] == "--no-open") openAfter = false;
            else if (args[i] == "--shot" && i + 1 < args.Length) shot = args[++i];
            else if (args[i] == "--state" && i + 1 < args.Length) state = args[++i];
        }
        if (removing && !moved && listed)
        {
            // started from <home>\current (or app-<version>): that is the Rove to remove
            var dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            var name = Path.GetFileName(dir);
            if (name.Equals("current", StringComparison.OrdinalIgnoreCase) || name.StartsWith("app-", StringComparison.OrdinalIgnoreCase)) home = Path.GetDirectoryName(dir);
        }
        // a copy in %TEMP% does the removing: the exe in the folder would keep it from going
        if (removing && !moved && Inside(Assembly.GetExecutingAssembly().Location, home))
        {
            var copy = Path.Combine(Path.GetTempPath(), "RoveSetup-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".exe");
            File.Copy(Assembly.GetExecutingAssembly().Location, copy);
            var rest = new List<string> { "--uninstall", listed ? "--from" : "--home", Quote(home) };
            if (!listed) rest.Add("--moved-test");
            rest.Add("--after"); rest.Add(Process.GetCurrentProcess().Id.ToString());
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--go" || args[i] == "--no-links") rest.Add(args[i]);
                else if (args[i] == "--links-to" && i + 1 < args.Length) { rest.Add(args[i]); rest.Add(Quote(args[++i])); }
            }
            Process.Start(new ProcessStartInfo(copy, string.Join(" ", rest)) { UseShellExecute = false });
            return 0;
        }
        if (Array.IndexOf(args, "--moved-test") >= 0) moved = true;
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        var app = new Application();
        app.ShutdownMode = ShutdownMode.OnMainWindowClose;
        using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("setup.xaml"))
            win = (Window)XamlReader.Load(s);
        win.FontFamily = LoadFont();
        Wire();
        if (removing) WireRemove();
        if (!openAfter) Part<ToggleButton>("Open").IsChecked = false;
        if (goNow) { win.WindowStartupLocation = WindowStartupLocation.Manual; win.Left = -10000; win.Top = -10000; }
        if (shot != null)
        {
            win.WindowStartupLocation = WindowStartupLocation.Manual; win.Left = -10000; win.Top = -10000;
            Draw(state);
            win.Loaded += delegate { Shoot(shot); win.Close(); };
        }
        else
        {
            if (removing) win.Loaded += delegate { Look(); if (goNow && Part<Button>("Go").IsEnabled) Remove(); };
            else win.Loaded += async delegate { await Find(); if (goNow && version != null) Go(); };
        }
        app.Run(win);
        if (moved) Forget();
        return Environment.ExitCode;
    }

    // the window's font: Pretendard at the kit's three weights, made by setup/font.py and
    // carried inside the exe; WPF reads font files from a folder, so they go to %TEMP% first
    static FontFamily LoadFont()
    {
        try
        {
            var asm = Assembly.GetExecutingAssembly();
            var dir = Path.Combine(Path.GetTempPath(), "RoveSetup-fonts-" + asm.ManifestModule.ModuleVersionId.ToString("N").Substring(0, 8));
            Directory.CreateDirectory(dir);
            foreach (var w in new[] { "450", "550", "650" })
            {
                var to = Path.Combine(dir, "RoveSetup-" + w + ".ttf");
                if (File.Exists(to)) continue;
                using (var s = asm.GetManifestResourceStream("RoveSetup-" + w + ".ttf"))
                using (var f = File.Create(to + ".part")) s.CopyTo(f);
                File.Move(to + ".part", to);
            }
            return new FontFamily(new Uri(dir + "\\"), "./#Rove Setup Sans, Malgun Gothic, Segoe UI");
        }
        catch { return new FontFamily("Malgun Gothic, Segoe UI"); }
    }

    static void Wire()
    {
        Part<TextBlock>("Folder").Text = home;
        MouseButtonEventHandler drag = delegate(object o, MouseButtonEventArgs e) { if (e.ButtonState == MouseButtonState.Pressed) win.DragMove(); };
        Part<Border>("Bar").MouseLeftButtonDown += drag;
        Part<Border>("Side").MouseLeftButtonDown += drag;
        Part<Button>("Close").Click += delegate { Quit(); };
        Part<Button>("Cancel").Click += delegate { if (busy) stop.Cancel(); else Quit(); };
        Part<Button>("Go").Click += delegate { if (removing) { if (!busy) Remove(); } else if (done) { Launch(); Quit(); } else if (!busy) Go(); };
        // removing has no stop: once it runs, Esc does nothing and the window stays until it is done
        // (closing it half-way left current, app-* and the installed apps entry behind)
        win.KeyDown += delegate(object o, KeyEventArgs e) { if (e.Key != Key.Escape) return; if (!busy) Quit(); else if (!removing) stop.Cancel(); };
        win.Closing += delegate(object o, System.ComponentModel.CancelEventArgs e) { if (removing && busy) e.Cancel = true; };

        foreach (var n in new[] { "Desk", "Menu", "Open", "Mine" })
        {
            var t = Part<ToggleButton>(n);
            RoutedEventHandler slide = delegate { Slide(t); };
            t.Checked += slide; t.Unchecked += slide;
        }
        if (removing) return;
        var stepsPanel = Part<StackPanel>("Steps");
        AddStep(stepsPanel, "받기", "M12 4v11M7 10l5 5 5-5M5 20h14");
        AddStep(stepsPanel, "파일 확인", "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z");
        AddStep(stepsPanel, "풀기", "M3 8V6a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 8h9");
        AddStep(stepsPanel, "바로가기", "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4");
        Part<Button>("Go").IsEnabled = false;
        Say("새 버전을 찾는 중", null);
    }

    // the knob has jumped to its side (a template setter); it slides the 15px there, 165 ms ease-out.
    // Windows set to show no animations: it only jumps.
    static void Slide(ToggleButton t)
    {
        if (!SystemParameters.ClientAreaAnimation) return;
        var move = t.Template.FindName("Move", t) as TranslateTransform;
        if (move == null) return;
        var a = new System.Windows.Media.Animation.DoubleAnimation(t.IsChecked == true ? -15 : 15, 0, TimeSpan.FromMilliseconds(165));
        a.EasingFunction = new System.Windows.Media.Animation.QuadraticEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut };
        move.BeginAnimation(TranslateTransform.XProperty, a);
    }

    static void AddStep(StackPanel panel, string name, string shape)
    {
        var s = new Step { Shape = shape };
        s.Icon = new SPath { Data = Geometry.Parse(shape), Stroke = Res("Soft"), StrokeThickness = 1.8, StrokeStartLineCap = PenLineCap.Round, StrokeEndLineCap = PenLineCap.Round, StrokeLineJoin = PenLineJoin.Round, Width = 24, Height = 24 };
        var box = new Viewbox { Width = 14, Height = 14, Child = s.Icon, VerticalAlignment = VerticalAlignment.Center };
        s.Name = new TextBlock { Text = name, FontSize = 14, FontWeight = FontWeight.FromOpenTypeWeight(550), Foreground = Res("Soft"), Margin = new Thickness(11, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        var line = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(12, 0, 8, 0) };
        line.Children.Add(box); line.Children.Add(s.Name);
        s.Row = new Border { Height = 36, CornerRadius = new CornerRadius(7), Margin = new Thickness(0, 0, 0, 3), Child = line, Background = Brushes.Transparent };
        panel.Children.Add(s.Row);
        steps.Add(s);
    }

    // 0..n-1: that step runs (and the ones before are done); n: all done; -1: none
    static void Mark(int now, bool failed)
    {
        for (int i = 0; i < steps.Count; i++)
        {
            var s = steps[i];
            bool isDone = now < 0 ? false : i < now, isNow = i == now;
            s.Row.Background = isNow ? Res("Chosen") : Brushes.Transparent;
            s.Name.Foreground = isNow ? (failed ? Res("Alarm") : Res("Head")) : isDone ? Res("Text") : Res("Soft");
            s.Icon.Stroke = isNow ? (failed ? Res("Alarm") : Res("Accent")) : isDone ? Res("Accent") : Res("Soft");
            s.Icon.Data = Geometry.Parse(isDone ? "M5 12.5l4.5 4.5L19 7.5" : s.Shape);
        }
    }

    static void Say(string what, string amount) { Say(what, amount, false); }
    static void Say(string what, string amount, bool bad)
    {
        var st = Part<TextBlock>("Status");
        st.Text = what;
        st.Foreground = bad ? Res("Alarm") : Res("Text");
        Part<TextBlock>("Amount").Text = amount ?? "";
    }

    static void Progress(double part)
    {
        var track = Part<Grid>("Track");
        Part<Border>("Fill").Width = Math.Max(0, Math.Min(1, part)) * Math.Max(0, track.ActualWidth);
    }

    static string Mb(long bytes) { return Math.Round(bytes / 1048576.0) + " MB"; }

    static HttpClient Client()
    {
        var c = new HttpClient(new HttpClientHandler { AllowAutoRedirect = true });
        c.Timeout = Timeout.InfiniteTimeSpan;   // the download has its own stop; latest.json its own timeout
        c.DefaultRequestHeaders.UserAgent.ParseAdd("RoveSetup/1.0");
        return c;
    }

    // latest.json: what the newest release is, checked as install.cmd checks it
    static async Task Find()
    {
        try
        {
            string json;
            using (var c = Client())
            using (var t = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
            {
                var r = await c.GetAsync(Base + "latest.json", t.Token);
                r.EnsureSuccessStatusCode();
                json = await r.Content.ReadAsStringAsync();
            }
            var d = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
            version = d["version"] as string; file = d["file"] as string; sha256 = d["sha256"] as string;
            size = Convert.ToInt64(d["size"]);
            if (version == null || file == null || sha256 == null || !Safe.IsMatch(version) || !Safe.IsMatch(file) || !Hex64.IsMatch(sha256) || size <= 0)
                throw new InvalidDataException();
        }
        catch (InvalidDataException) { version = null; Say("latest.json이 이상해요", null, true); Again(); return; }
        catch (Exception) { version = null; Say("GitHub에 닿지 않아요", null, true); Again(); return; }

        var shown = version.Split('-')[0];
        Part<TextBlock>("Title").Text = "Rove " + shown;
        Part<TextBlock>("Build").Text = version.Substring(shown.Length).TrimStart('-');
        Part<TextBlock>("Size").Text = Mb(size);
        var have = File.Exists(Path.Combine(home, "app-" + version, "Rove.exe"));
        Say(have ? "이 버전은 이미 있어요" : "설치할 준비가 됐어요", null);
        var go = Part<Button>("Go");
        go.Content = "설치"; go.IsEnabled = true; go.Focus();
    }

    // a failure: the blue button tries again from the top
    static void Again()
    {
        if (goNow) { Environment.ExitCode = 1; win.Dispatcher.BeginInvoke(new Action(Quit)); }
        var go = Part<Button>("Go");
        go.Content = "다시"; go.IsEnabled = true;
        busy = false;
        Part<Button>("Cancel").Content = "닫기";
        foreach (var n in new[] { "Desk", "Menu", "Open" }) Part<ToggleButton>(n).IsEnabled = true;
    }

    static async void Go()
    {
        if (version == null) { Say("새 버전을 찾는 중", null); Part<Button>("Go").IsEnabled = false; await Find(); return; }
        busy = true; stop = new CancellationTokenSource();
        var go = Part<Button>("Go"); go.IsEnabled = false;
        Part<Button>("Cancel").Content = "멈추기";
        foreach (var n in new[] { "Desk", "Menu", "Open" }) Part<ToggleButton>(n).IsEnabled = false;
        int at = 0;
        try
        {
            Directory.CreateDirectory(home);
            var to = Path.Combine(home, "app-" + version);
            if (!File.Exists(Path.Combine(to, "Rove.exe")))
            {
                var zip = Path.Combine(home, version + ".zip.part");
                Mark(at = 0, false);
                await Fetch(zip);
                Mark(at = 1, false);
                Say("받은 파일을 확인했어요", "sha256");
                Mark(at = 2, false);
                Say("푸는 중", null);
                var tmp = to + ".tmp";
                await Task.Run(delegate
                {
                    if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
                    ZipFile.ExtractToDirectory(zip, tmp);
                    File.Delete(zip);
                    if (!File.Exists(Path.Combine(tmp, "Rove.exe"))) throw new IOException("unpack");
                    Directory.Move(tmp, to);
                });
            }
            Mark(at = 3, false);
            Say("바로가기를 만드는 중", null);
            await Task.Run(delegate { Link(to); if (listed) List(to); });
            Mark(steps.Count, false);
            Progress(1);
            done = true; busy = false;
            Part<Button>("Cancel").Content = "닫기";
            if (goNow && Part<ToggleButton>("Open").IsChecked != true) { Quit(); return; }
            if (Part<ToggleButton>("Open").IsChecked == true)
            {
                Say("다 됐어요. Rove를 켜요", null);
                Launch();
                await Task.Delay(700);
                Quit();
                return;
            }
            Say("다 됐어요", "Rove " + version.Split('-')[0]);
            go.Content = "Rove 열기"; go.IsEnabled = true; go.Focus();
        }
        catch (OperationCanceledException) { Mark(-1, false); Progress(0); Say("멈췄어요", null); Again(); go.Content = "설치"; }
        catch (InvalidDataException) { Mark(at, true); Say("받은 파일이 깨졌어요(sha256이 달라요)", null, true); Again(); }
        catch (HttpRequestException) { Mark(at, true); Say("받지 못했어요", null, true); Again(); }
        catch (IOException) { Mark(at, true); Say(at == 2 ? "풀지 못했어요" : "넣지 못했어요", null, true); Again(); }
        catch (Exception) { Mark(at, true); Say("넣지 못했어요", null, true); Again(); }
    }

    // the zip, hashed as it comes in; on a stop or a bad hash the part file goes
    static async Task Fetch(string zip)
    {
        try
        {
            using (var c = Client())
            using (var r = await c.GetAsync(Base + file, HttpCompletionOption.ResponseHeadersRead, stop.Token))
            {
                r.EnsureSuccessStatusCode();
                long total = r.Content.Headers.ContentLength ?? size, got = 0, shown = -1;
                using (var from = await r.Content.ReadAsStreamAsync())
                using (var into = new FileStream(zip, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 16, true))
                using (var h = SHA256.Create())
                {
                    var buf = new byte[1 << 16];
                    int n;
                    while ((n = await from.ReadAsync(buf, 0, buf.Length, stop.Token)) > 0)
                    {
                        h.TransformBlock(buf, 0, n, null, 0);
                        await into.WriteAsync(buf, 0, n, stop.Token);
                        got += n;
                        var mb = got >> 20;
                        if (mb != shown)
                        {
                            shown = mb;
                            Say("받는 중", Mb(got) + " / " + Mb(total));
                            Progress((double)got / total);
                        }
                    }
                    h.TransformFinalBlock(buf, 0, 0);
                    if (BitConverter.ToString(h.Hash).Replace("-", "").ToLowerInvariant() != sha256) throw new InvalidDataException();
                }
            }
        }
        catch { try { File.Delete(zip); } catch { } throw; }
    }

    // current -> app-<version> (made beside, then swapped in, as update.cjs does), then the shortcuts
    static void Link(string to)
    {
        var link = Path.Combine(home, "current");
        var next = Path.Combine(home, "current.next");
        if (Directory.Exists(next)) Directory.Delete(next);
        Run("cmd.exe", "/c mklink /J \"" + next + "\" \"" + to + "\"");
        if (!Directory.Exists(next)) throw new IOException("junction");
        if (Directory.Exists(link)) Directory.Delete(link);   // a junction: removes the link, not what it points to
        Directory.Move(next, link);
        if (!links) return;
        var exe = Path.Combine(link, "Rove.exe");
        var places = new List<string>();
        bool desk = false, menu = false;
        win.Dispatcher.Invoke(delegate { desk = Part<ToggleButton>("Desk").IsChecked == true; menu = Part<ToggleButton>("Menu").IsChecked == true; });
        if (desk) places.Add(linksTo != null ? Path.Combine(linksTo, "Desktop") : Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
        if (menu) places.Add(linksTo != null ? Path.Combine(linksTo, "Programs") : Environment.GetFolderPath(Environment.SpecialFolder.Programs));
        foreach (var p in places) Directory.CreateDirectory(p);
        if (places.Count == 0) return;
        dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        foreach (var p in places)
        {
            dynamic s = shell.CreateShortcut(Path.Combine(p, "Rove.lnk"));
            s.TargetPath = exe; s.WorkingDirectory = link; s.IconLocation = exe + ",0"; s.Description = "Rove";
            s.Save();
        }
    }

    static void Run(string exe, string args)
    {
        using (var p = Process.Start(new ProcessStartInfo(exe, args) { CreateNoWindow = true, UseShellExecute = false }))
            p.WaitForExit();
    }

    static void Launch()
    {
        var exe = Path.Combine(home, "current", "Rove.exe");
        if (File.Exists(exe)) Process.Start(new ProcessStartInfo(exe) { WorkingDirectory = Path.Combine(home, "current"), UseShellExecute = true });
    }

    static void Quit()
    {
        if (stop != null) stop.Cancel();
        win.Close();
    }

    // ---- Windows' installed apps -------------------------------------------------------------
    // The same values Rove writes at every start (update.cjs listed()); its remove button runs
    // current\RoveSetup.exe --uninstall.
    static void List(string to)
    {
        var cur = Path.Combine(home, "current");
        if (!File.Exists(Path.Combine(to, "RoveSetup.exe"))) return;   // a release from before it
        using (var k = Registry.CurrentUser.CreateSubKey(UninstallKey))
        {
            k.SetValue("DisplayName", "Rove");
            k.SetValue("DisplayVersion", version.Split('-')[0]);
            k.SetValue("Publisher", "yoonrobin.xyz");
            k.SetValue("DisplayIcon", Path.Combine(cur, "Rove.exe") + ",0");
            k.SetValue("InstallLocation", home);
            k.SetValue("UninstallString", Quote(Path.Combine(cur, "RoveSetup.exe")) + " --uninstall");
            k.SetValue("URLInfoAbout", "https://rove.yoonrobin.xyz/");
            k.SetValue("NoModify", 1, RegistryValueKind.DWord);
            k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            k.SetValue("EstimatedSize", (int)(Bytes(to) / 1024), RegistryValueKind.DWord);
        }
    }

    // ---- removing ---------------------------------------------------------------------------
    static bool Inside(string path, string dir)
    {
        return Path.GetFullPath(path).StartsWith(dir.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase);
    }
    static string Quote(string s) { return "\"" + s + "\""; }

    // a Rove install: the folder holds current or an app-<version> (nothing else is ever removed)
    static bool IsRove(string dir)
    {
        return Directory.Exists(dir) && (Directory.Exists(Path.Combine(dir, "current")) || Directory.GetDirectories(dir, "app-*").Length > 0);
    }

    static long Bytes(string dir)
    {
        long n = 0;
        try
        {
            foreach (var f in new DirectoryInfo(dir).GetFiles("*", SearchOption.AllDirectories)) n += f.Length;
        }
        catch { }
        return n;
    }

    static List<string> LinkPlaces()
    {
        var places = new List<string>();
        if (!links) return places;
        places.Add(linksTo != null ? Path.Combine(linksTo, "Desktop") : Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
        places.Add(linksTo != null ? Path.Combine(linksTo, "Programs") : Environment.GetFolderPath(Environment.SpecialFolder.Programs));
        return places;
    }

    // the Rove.lnk files that start this install's Rove (one made for another stays)
    static List<string> OurLinks()
    {
        var found = new List<string>();
        dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        foreach (var p in LinkPlaces())
        {
            var f = Path.Combine(p, "Rove.lnk");
            if (!File.Exists(f)) continue;
            string target = shell.CreateShortcut(f).TargetPath;
            if (!string.IsNullOrEmpty(target) && Inside(target, home)) found.Add(f);
        }
        return found;
    }

    static List<Process> Running()
    {
        var found = new List<Process>();
        foreach (var p in Process.GetProcessesByName("Rove"))
        {
            try { if (Inside(p.MainModule.FileName, home)) { found.Add(p); continue; } } catch { }
            p.Dispose();
        }
        return found;
    }

    static void WireRemove()
    {
        win.Title = "Rove 지우기";
        Part<TextBlock>("SideLabel").Text = "지우기";
        Part<StackPanel>("InstallCards").Visibility = Visibility.Collapsed;
        Part<StackPanel>("RemoveCards").Visibility = Visibility.Visible;
        Part<Grid>("Track").Visibility = Visibility.Collapsed;
        var go = Part<Button>("Go");
        go.Style = (Style)win.Resources["Danger"]; go.Content = "지우기"; go.IsDefault = false;
        Part<TextBlock>("RFolder").Text = home;
        var stepsPanel = Part<StackPanel>("Steps");
        AddStep(stepsPanel, "Rove 끄기", "M6 6l12 12M18 6L6 18");
        AddStep(stepsPanel, "파일 지우기", "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6");
        AddStep(stepsPanel, "바로가기 지우기", "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4");
        AddStep(stepsPanel, "목록에서 빼기", "M4 7h16M4 12h16M4 17h16");
    }

    // what there is to remove
    static void Look()
    {
        var go = Part<Button>("Go");
        Part<TextBlock>("Title").Text = "Rove 지우기";
        if (!IsRove(home)) { Say("여기에는 Rove가 없어요", null, true); go.IsEnabled = false; if (goNow) { Environment.ExitCode = 1; Quit(); } return; }
        var cur = Current();
        var name = cur == null ? "" : Path.GetFileName(cur);
        Part<TextBlock>("Build").Text = name.StartsWith("app-") ? name.Substring(4).Split('-')[0] : "";
        long n = 0;
        foreach (var d in Directory.GetDirectories(home, "app-*")) n += Bytes(d);
        Part<TextBlock>("RSize").Text = Mb(n);
        var names = new List<string>();
        foreach (var f in OurLinks()) names.Add(Path.GetFileName(Path.GetDirectoryName(f)).Equals("Desktop", StringComparison.OrdinalIgnoreCase) || f.StartsWith(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), StringComparison.OrdinalIgnoreCase) ? "바탕화면" : "시작 메뉴");
        Part<TextBlock>("RLinks").Text = names.Count == 0 ? "없음" : string.Join("·", names);
        var on = Running();
        Say(on.Count > 0 ? "Rove가 켜져 있어요. 지우면 닫혀요" : "지울 준비가 됐어요", null);
        foreach (var p in on) p.Dispose();
        go.IsEnabled = true;
    }

    // where the junction current points (dir /al prints "current [<target>]")
    static string Current()
    {
        try
        {
            var r = new Process { StartInfo = new ProcessStartInfo("cmd.exe", "/d /c dir /al " + Quote(home)) { CreateNoWindow = true, UseShellExecute = false, RedirectStandardOutput = true } };
            r.Start();
            var text = r.StandardOutput.ReadToEnd();
            r.WaitForExit();
            var m = Regex.Match(text, @"current \[(.+?)\]");
            return m.Success ? m.Groups[1].Value : null;
        }
        catch { return null; }
    }

    static async void Remove()
    {
        busy = true;
        var go = Part<Button>("Go"); go.IsEnabled = false;
        Part<Button>("Cancel").IsEnabled = false;
        Part<Button>("Close").IsEnabled = false;
        Part<ToggleButton>("Mine").IsEnabled = false;
        bool mine = Part<ToggleButton>("Mine").IsChecked == true;
        int at = 0;
        try
        {
            Mark(at = 0, false);
            Say("Rove를 닫는 중", null);
            await Task.Run(delegate
            {
                if (after > 0) { try { using (var first = Process.GetProcessById(after)) first.WaitForExit(10000); } catch (ArgumentException) { } }
                foreach (var p in Running()) { try { p.Kill(); p.WaitForExit(5000); } catch { } p.Dispose(); }
            });
            Mark(at = 1, false);
            Say("파일을 지우는 중", null);
            await Task.Run(delegate
            {
                // the junctions first: removing one leaves what it points at
                foreach (var j in new[] { "current", "current.next" }) { var d = Path.Combine(home, j); if (Directory.Exists(d)) Directory.Delete(d); }
                foreach (var d in Directory.GetDirectories(home, "app-*")) Directory.Delete(d, true);
                foreach (var f in Directory.GetFiles(home, "*.zip.part")) File.Delete(f);
                if (mine)
                {
                    Directory.Delete(home, true);
                    // Chromium's own folder (Local State, GPU caches): the PC install's only
                    var roaming = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Rove");
                    if (listed && Directory.Exists(roaming)) Directory.Delete(roaming, true);
                }
            });
            Mark(at = 2, false);
            Say("바로가기를 지우는 중", null);
            await Task.Run(delegate { foreach (var f in OurLinks()) File.Delete(f); });
            Mark(at = 3, false);
            if (listed) await Task.Run(delegate { Unlist(); });
            Mark(steps.Count, false);
            Say(mine ? "다 지웠어요" : "다 지웠어요. 방문 기록·즐겨찾기는 남겨 뒀어요", null);
            busy = false;
            go.Visibility = Visibility.Collapsed;
            Part<Button>("Close").IsEnabled = true;
            var cancel = Part<Button>("Cancel"); cancel.IsEnabled = true; cancel.Content = "닫기"; cancel.Focus();
            if (goNow) Quit();
        }
        catch (Exception)
        {
            Mark(at, true);
            Say(at == 1 ? "지우지 못했어요. 열린 파일이 있는지 봐 주세요" : "지우지 못했어요", null, true);
            busy = false;
            go.Content = "다시"; go.IsEnabled = true;
            Part<Button>("Cancel").IsEnabled = true;
            Part<Button>("Close").IsEnabled = true;
            Part<ToggleButton>("Mine").IsEnabled = true;
            if (goNow) { Environment.ExitCode = 1; Quit(); }
        }
    }

    // out of Windows' lists: the installed apps entry and the browser registration
    // (defaults.cjs register()), each only when it is this install's
    static void Unlist()
    {
        bool ours;
        using (var k = Registry.CurrentUser.OpenSubKey(UninstallKey))
            ours = k != null && home.TrimEnd('\\').Equals(((k.GetValue("InstallLocation") as string) ?? "").TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
        if (ours) Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false);
        const string client = @"Software\Clients\StartMenuInternet\Rove";
        string command = null;
        using (var k = Registry.CurrentUser.OpenSubKey(client + @"\shell\open\command")) if (k != null) command = k.GetValue("") as string;
        if (command == null || command.IndexOf(home.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase) < 0) return;
        Registry.CurrentUser.DeleteSubKeyTree(client, false);
        Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\RoveURL", false);
        Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\RoveHTML", false);
        using (var k = Registry.CurrentUser.OpenSubKey(@"Software\RegisteredApplications", true)) if (k != null) k.DeleteValue("Rove", false);
    }

    // the %TEMP% copy goes a moment after it quits
    static void Forget()
    {
        var self = Assembly.GetExecutingAssembly().Location;
        Process.Start(new ProcessStartInfo("cmd.exe", "/d /c ping -n 3 127.0.0.1 >nul & del /f /q " + Quote(self)) { CreateNoWindow = true, UseShellExecute = false });
    }

    // ---- for tests: the window in one of its states, drawn to a png -------------------------
    static void Draw(string state)
    {
        if (removing) { win.Loaded += delegate { Look(); }; return; }
        version = "1.1.3-20261126-1450-e5c59be"; size = 164742674;
        Part<TextBlock>("Title").Text = "Rove 1.1.3";
        Part<TextBlock>("Build").Text = "20261126-1450-e5c59be";
        Part<TextBlock>("Size").Text = Mb(size);
        var go = Part<Button>("Go"); go.IsEnabled = true;
        win.Loaded += delegate
        {
            if (state == "down") { Mark(0, false); Say("받는 중", Mb(69206016) + " / " + Mb(size)); Progress(0.42); go.IsEnabled = false; Part<Button>("Cancel").Content = "멈추기"; }
            else if (state == "unpack") { Mark(2, false); Say("푸는 중", null); Progress(1); go.IsEnabled = false; }
            else if (state == "done") { Mark(steps.Count, false); Say("다 됐어요", "Rove 1.1.3"); Progress(1); go.Content = "Rove 열기"; }
            else if (state == "bad") { Mark(1, true); Say("받은 파일이 깨졌어요(sha256이 달라요)", null, true); go.Content = "다시"; }
            else Say("설치할 준비가 됐어요", null);
        };
    }

    static void Shoot(string png)
    {
        win.UpdateLayout();
        var root = (FrameworkElement)win.Content;
        var scale = 2.0;
        var bmp = new RenderTargetBitmap((int)(root.ActualWidth * scale) + 64, (int)(root.ActualHeight * scale) + 64, 96 * scale, 96 * scale, PixelFormats.Pbgra32);
        var dv = new DrawingVisual();
        using (var dc = dv.RenderOpen())
        {
            dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(0x1c, 0x1e, 0x22)), null, new Rect(0, 0, root.ActualWidth + 32, root.ActualHeight + 32));
            dc.DrawRectangle(new VisualBrush(root), null, new Rect(0, 0, root.ActualWidth, root.ActualHeight));
        }
        bmp.Render(dv);
        var enc = new PngBitmapEncoder();
        enc.Frames.Add(BitmapFrame.Create(bmp));
        using (var f = File.Create(png)) enc.Save(f);
    }
}
