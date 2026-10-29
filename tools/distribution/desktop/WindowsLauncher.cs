using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

[assembly: AssemblyTitle("SalesGod Bridge")]
[assembly: AssemblyDescription("Starts the local SalesGod audio bridge. Does not place calls.")]
[assembly: AssemblyVersion("1.0.3.0")]
internal static class WindowsLauncher
{
    private static int Main(string[] args)
    {
        bool check = args.Length == 1 && args[0] == "--check";
        try
        {
            if (args.Length != 0 && !check) throw new Exception("This launcher takes no options. Double-click SalesGod Bridge.exe to start.");
            string folder = AppDomain.CurrentDomain.BaseDirectory;
            if (!File.Exists(Path.Combine(folder, "Start Windows.cmd")))
                throw new Exception("Extract the entire SalesGod-Team ZIP first. Keep SalesGod Bridge.exe inside that folder beside Start Windows.cmd. You can create a desktop shortcut to it.");
            if (check) { Console.WriteLine("SalesGod launcher files found. No bridge started."); return 0; }
            Console.Title = "SalesGod Bridge - keep this window open";
            Console.WriteLine("Starting SalesGod Bridge. No commands to type. No calls start automatically.\n");
            // The command is a fixed filename; the installation path is passed
            // as WorkingDirectory, never interpolated into shell code.
            var start = new ProcessStartInfo {
                FileName = Path.Combine(Environment.SystemDirectory, "cmd.exe"),
                Arguments = "/d /s /c \"\"Start Windows.cmd\"\"",
                WorkingDirectory = folder,
                UseShellExecute = false
            };
            using (Process process = Process.Start(start)) {
                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            if (!check && !Console.IsInputRedirected) {
                Console.WriteLine("Press any key to close."); Console.ReadKey(true);
            }
            return 1;
        }
    }
}
