// Run once as a Quantumult X task. Diagnostics expire after 10 minutes.
(function(){try{$prefs.setValueForKey(String(Date.now()+10*60*1000),'ForADM.DebugUntil');console.log('[For-ADM] 诊断已开启，10 分钟后自动关闭；请重新打开可可影视/网飞猫页面。');}finally{$done();}})();
