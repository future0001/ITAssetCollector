XP client notes
===============

The XP package contains a .NET Framework 4.0 WinForms client.

If Windows XP shows error 0xc0000135 when opening the EXE directly, the
machine does not have the required .NET runtime installed.

Target machine requirement:
- Windows XP SP3
- Microsoft .NET Framework 4 Full, not only Client Profile

Recommended startup:
1. Install Microsoft .NET Framework 4 Full on the XP machine.
2. Keep these files in the same folder:
   - start-xp-client.cmd
   - the *-XP.exe file
   - the *-XP.exe.config file
3. Run start-xp-client.cmd.

Server compatibility:
- This XP client uses the same server API as the current client.
- Default server URL is configured in the .exe.config file.
