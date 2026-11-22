"""Compile the real launcher and exercise its exception boundary with Java fixtures.

This complements the Android SDK build. It does not emulate a phone or Chrome.
No accounts, credentials, network requests or application data are used.
"""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
SOURCES = {
    "android/content/pm/ActivityInfo.java": "package android.content.pm; public class ActivityInfo { public static final int SCREEN_ORIENTATION_UNSPECIFIED=-1; }",
    "android/net/Uri.java": "package android.net; public class Uri { private String url; private Uri(String u){url=u;} public static Uri parse(String u){return new Uri(u);} public String toString(){return url;} }",
    "android/os/Bundle.java": "package android.os; public class Bundle {}",
    "android/os/Build.java": "package android.os; public class Build { public static class VERSION { public static int SDK_INT=36; } public static class VERSION_CODES { public static final int O=26; } }",
    "android/util/Log.java": "package android.util; public class Log { public static int w(String tag,String message,Throwable error){return 0;} }",
    "com/google/androidbrowserhelper/trusted/LauncherActivity.java": """package com.google.androidbrowserhelper.trusted;
public class LauncherActivity {
 public static RuntimeException failure;
 public boolean browserLaunched=false;
 public int orientation=100;
 protected void onCreate(android.os.Bundle bundle) { browserLaunched=true; if(failure!=null)throw failure; }
 public void setRequestedOrientation(int value) { orientation=value; }
 protected android.net.Uri getLaunchingUrl(){return android.net.Uri.parse("https://momentumvelo.app/mercados?source=android");}
} """,
    "app/momentumvelo/LauncherActivityHarness.java": """package app.momentumvelo;
public class LauncherActivityHarness {
 static void verify(boolean value,String message){if(!value)throw new AssertionError(message);}
 static RuntimeException shortcut(RuntimeException error){
  error.setStackTrace(new StackTraceElement[]{new StackTraceElement(
   "com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity","addSiteSettingsShortcut","ManageDataLauncherActivity.java",440)});
  return error;
 }
 public static void main(String[] args){
  com.google.androidbrowserhelper.trusted.LauncherActivity.failure=null;
  LauncherActivity normal=new LauncherActivity();normal.onCreate(null);
  verify(normal.browserLaunched,"Normal launch must reach browser");
  verify(normal.getLaunchingUrl().toString().equals("https://momentumvelo.app/mercados?source=android"),"Launch destination must remain intact");
  com.google.androidbrowserhelper.trusted.LauncherActivity.failure=shortcut(new IllegalArgumentException("Launcher rejected shortcut"));
  LauncherActivity optional=new LauncherActivity();optional.onCreate(null);
  verify(optional.browserLaunched,"Optional shortcut failure happens after browser launch");
  verify(optional.orientation==-1,"Optional failure must finish app initialization");
  IllegalArgumentException unrelated=new IllegalArgumentException("Malformed launch configuration");
  com.google.androidbrowserhelper.trusted.LauncherActivity.failure=unrelated;
  boolean propagated=false;
  try {new LauncherActivity().onCreate(null);}catch(IllegalArgumentException error){propagated=error==unrelated;}
  verify(propagated,"Unrelated launch failure must propagate");
  RuntimeException fatal=shortcut(new IllegalStateException("Other launch failure"));
  com.google.androidbrowserhelper.trusted.LauncherActivity.failure=fatal;
  propagated=false;
  try {new LauncherActivity().onCreate(null);}catch(RuntimeException error){propagated=error==fatal;}
  verify(propagated,"Other exception classes must propagate");
  System.out.println("4 launcher scenarios passed (Java fixtures, not a device test)");
 }
} """,
}

with tempfile.TemporaryDirectory(prefix="momentum-launcher-") as directory:
    work = Path(directory)
    files = []
    for relative, text in SOURCES.items():
        target = work / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        files.append(str(target))
    actual = ROOT / "app/src/main/java/app/momentumvelo/LauncherActivity.java"
    subprocess.run(["javac", "-d", str(work / "classes"), *files, str(actual)], check=True)
    subprocess.run(["java", "-ea", "-cp", str(work / "classes"), "app.momentumvelo.LauncherActivityHarness"], check=True)
