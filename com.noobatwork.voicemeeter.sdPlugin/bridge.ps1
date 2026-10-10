$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
function Send($x){[Console]::Out.WriteLine(($x|ConvertTo-Json -Compress -Depth 6));[Console]::Out.Flush()}
$code=@'
using System;
using System.Runtime.InteropServices;
public class VM {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]public static extern bool SetDllDirectory(string path);
 [DllImport("VoicemeeterRemote64.dll")]public static extern int VBVMR_Login();
 [DllImport("VoicemeeterRemote64.dll")]public static extern int VBVMR_Logout();
 [DllImport("VoicemeeterRemote64.dll")]public static extern int VBVMR_IsParametersDirty();
 [DllImport("VoicemeeterRemote64.dll",CharSet=CharSet.Ansi)]public static extern int VBVMR_GetParameterFloat(string name,out float value);
 [DllImport("VoicemeeterRemote64.dll",CharSet=CharSet.Ansi)]public static extern int VBVMR_SetParameterFloat(string name,float value);
}
'@
try {
 Add-Type -TypeDefinition $code
 $folder='C:\Program Files (x86)\VB\Voicemeeter'
 if($env:NAW_VOICEMEETER_DLL){$folder=$env:NAW_VOICEMEETER_DLL}
 [void][VM]::SetDllDirectory($folder)
 $login=[VM]::VBVMR_Login()
 if($login -lt 0){throw "Voicemeeter login failed $login"}
 Send @{ready=$true}
 $valid='^(Strip|Bus)\[[0-7]\]\.(Gain|Mute)$'
 while($null -ne ($line=[Console]::ReadLine())){
  try {
   $q=$line|ConvertFrom-Json
   if($q.op -eq 'get'){
    [void][VM]::VBVMR_IsParametersDirty()
    $values=@{}
    foreach($path in $q.paths){if($path -notmatch $valid){continue};[single]$v=0;if([VM]::VBVMR_GetParameterFloat([string]$path,[ref]$v)-eq 0){$values[$path]=[double]$v}}
    Send @{values=$values}
   }elseif($q.op -eq 'set'){
    $path=[string]$q.path;$value=[double]$q.value
    if($path -notmatch $valid){continue}
    if($path.EndsWith('.Mute')){$value=if($value -gt 0.5){1}else{0}}else{$value=[Math]::Max(-60,[Math]::Min(12,$value))}
    [void][VM]::VBVMR_SetParameterFloat($path,[single]$value)
   }
  }catch{Send @{error=$_.Exception.Message}}
 }
} catch {Send @{error=$_.Exception.Message}} finally {try{[void][VM]::VBVMR_Logout()}catch{}}
