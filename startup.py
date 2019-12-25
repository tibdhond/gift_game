import time
import subprocess


proc = subprocess.check_output("ipconfig", universal_newlines=True)
proc = proc[proc.index("Wi-Fi"):]
if "IPv4 Address" in proc:
    proc = proc[proc.index("IPv4 Address"):]
    proc = proc[:proc.index("\n")]
    proc = proc[proc.index(": ")+2:]
else: proc = "localhost"

subprocess.Popen("npm start", shell=True)

time.sleep(2)
subprocess.call(["start", "http://%s:3000/people" % proc], shell=True)
