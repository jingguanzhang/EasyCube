"use strict";
var _jspdf = null;

self.onmessage = function (e) {
  var msg = e.data;

  if (msg.type === "init") {
    try {
      // 1. 先加载 jsPDF 核心库
      importScripts(msg.jspdfUrl);
      
      // 2. 映射 UMD 全局变量，让接下来的字体文件能找到 jsPDF.API
      self.jsPDF = self.jspdf.jsPDF; 
      
      // 3. 动态加载你在外部配置好的中文字体 js 文件
      if (msg.fontUrl) {
        importScripts(msg.fontUrl);
      }
      
      _jspdf = self.jspdf;
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", detail: "PDF 依赖加载失败: " + err.message });
    }
    return;
  }

  if (msg.type === "build") {
    try {
      var images = msg.images;
      var moveNames = msg.moveNames;
      var stepDescs = msg.stepDescs;
      var initialViews = msg.initialViews;
      var totalSteps = msg.totalSteps;
      var NN = msg.N;
      
      // 从主线程传过来的字体名称
      var fontName = msg.fontName || "helvetica"; 
      
      var jsPDF = _jspdf.jsPDF;
      // 初始化 PDF，由于上面 importScripts 了字体文件，它已经自动注册到 jsPDF 内部了
      var pdf = new jsPDF({ unit: "mm", format: "a4" });

      var PW = 210, PH = 297, MX = 12, MT = 18, MB = 12;
      var cW = PW - MX * 2, COLS = 5, ROWS = 6, SPP = 30;
      var HH = 0, FH = 6, gridH = PH - MT - MB - HH - FH;
      var cellW = cW / COLS, cellH = gridH / ROWS;
      var imgSz = Math.min(cellW - 4, cellH - 16); 

      var stepPages = Math.ceil(images.length / SPP);
      var totalPages = stepPages + 1; 

      function drawHeader(title) {
        pdf.setFontSize(14);
        pdf.setFont(fontName, "normal"); // 应用中文字体
        pdf.setTextColor(249, 115, 22);
        pdf.text(title, MX, MT);

        pdf.setFontSize(9);
        pdf.setTextColor(140, 140, 140);
        pdf.text("总步数: " + totalSteps + "   |   阶数: " + NN + "x" + NN, PW - MX, MT, { align: "right" });

        pdf.setDrawColor(249, 115, 22);
        pdf.setLineWidth(0.4);
        pdf.line(MX, MT + 2, PW - MX, MT + 2);
      }

      // ==========================================
      // 【第一页】初始状态大图与6面展示
      // ==========================================
      drawHeader("魔方求解步骤导出 - 初始状态");

      var bigW = 85, bigH = 85;
      var startY = MT + 15;
      var bigGap = 10; 

      pdf.addImage(initialViews[0], "JPEG", PW / 2 - bigW - bigGap / 2, startY, bigW, bigH);
      pdf.setFontSize(11);
      pdf.setTextColor(30, 30, 30);
      pdf.text("左-前-上 视图", PW / 2 - bigW / 2 - bigGap / 2, startY + bigH + 6, { align: "center" });

      pdf.addImage(initialViews[1], "JPEG", PW / 2 + bigGap / 2, startY, bigW, bigH);
      pdf.text("右-后-下 视图", PW / 2 + bigGap / 2 + bigW / 2, startY + bigH + 6, { align: "center" });

      var smallW = 45, smallH = 45;
      var gridStartY = startY + bigH + 20;
      var spacingX = 12, spacingY = 14;
      var startX = (PW - (3 * smallW + 2 * spacingX)) / 2;

      var faceLabels = ["U (顶面)", "D (底面)", "F (前面)", "B (后面)", "L (左面)", "R (右面)"];

      for (var i = 0; i < 6; i++) {
        var row = Math.floor(i / 3);
        var col = i % 3;
        var x = startX + col * (smallW + spacingX);
        var y = gridStartY + row * (smallH + spacingY);

        pdf.addImage(initialViews[i + 2], "JPEG", x, y, smallW, smallH);
        pdf.setFontSize(10);
        pdf.text(faceLabels[i], x + smallW / 2, y + smallH + 5, { align: "center" });
      }

      var now = new Date();
      var timeStr = now.getFullYear() + "-" + 
                    String(now.getMonth()+1).padStart(2,'0') + "-" + 
                    String(now.getDate()).padStart(2,'0') + " " + 
                    String(now.getHours()).padStart(2,'0') + ":" + 
                    String(now.getMinutes()).padStart(2,'0');

      pdf.setFontSize(8);
      pdf.setTextColor(180, 180, 180);
      pdf.text("生成时间: " + timeStr, MX, PH - 6);
      pdf.text("第 1 / " + totalPages + " 页", PW / 2, PH - 6, { align: "center" });
      
      // ==========================================
      // 【后续页】步骤拆解小图排布
      // ==========================================
      for (var p = 0; p < stepPages; p++) {
        pdf.addPage();
        drawHeader("魔方求解步骤导出 - 还原过程");

        var s0 = p * SPP, s1 = Math.min(s0 + SPP, images.length);

        for (var idx = s0; idx < s1; idx++) {
          var li = idx - s0, col = li % COLS, row = Math.floor(li / COLS);
          var cx = MX + col * cellW, cy = MT + HH + row * cellH;
          var ix = cx + (cellW - imgSz) / 2, iy = cy + 3;

          pdf.addImage(images[idx], "JPEG", ix, iy, imgSz, imgSz);
          var ly = iy + imgSz + 4; 

          pdf.setFontSize(8);
          pdf.setTextColor(30, 30, 30);

          if (idx === 0) {
            pdf.text("初始状态", cx + cellW / 2, ly, { align: "center" });
          } else {
            pdf.text("第 " + idx + " 步", cx + cellW / 2, ly, { align: "center" });
            
            pdf.setFontSize(8);
            pdf.setTextColor(249, 115, 22);
            pdf.text(moveNames[idx - 1] || "", cx + cellW / 2, ly + 4, { align: "center" });
            
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text(stepDescs[idx - 1] || "", cx + cellW / 2, ly + 8, { align: "center" });
          }
        }

        pdf.setFontSize(8);
        pdf.setTextColor(180, 180, 180);
        pdf.text("第 " + (p + 2) + " / " + totalPages + " 页", PW / 2, PH - 6, { align: "center" });
      }

      var ab = pdf.output("arraybuffer");
      self.postMessage({ type: "done", buffer: ab }, [ab]);
    } catch (err) {
      self.postMessage({ type: "error", detail: "PDF 组装失败: " + err.message });
    }
  }
};