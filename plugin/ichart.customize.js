/*!
 * simple ichartjs plugin template
 * version: 1.0
 * @requires ichartjs v1.0 or later,jquery
 * @site http://www.ichartjs.com/
 * @author taylor
 * @Copyright 2013-2023
 */
iChart.override(iChart.Rectangle2D, {
	drawRectangle : function() {
		/**
		 * 原来的方法
		 */
//		this.T.box(
//		this.get(this.X),//矩形左上角x坐标
//		this.get(this.Y),//矩形左上角y坐标
//		this.get(this.W),//矩形宽度
//		this.get(this.H),//矩形高度
//		this.get('border'),//矩形边框
//		this.get('f_color'),//矩形填充颜色
//		this.get('shadow'));//矩形阴影
		
		/**
		 * 可以根据上述参数，利用this.T.c自行实现绘制矩形的效果
		 * this.T.canvas：原生的canvas对象
		 * this.T.c：原生的canvas对象的Context2D对象
		 * eg:
		 */
		this.T.c.fillStyle = 'green';
		this.T.c.fillRect(this.get(this.X),this.get(this.Y),this.get(this.W),this.get(this.H));
		
	}
});