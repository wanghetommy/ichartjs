/*!
 * ichartjs sign Plugin
 * version: 1.0
 * @requires ichartjs v1.0 or later
 * @site http://www.ichartjs.com/
 * @author wanghe
 * @Copyright 2012 
 * wanghetommy@gmail.com 
 * Licensed under the Apache License, Version 2.0 (the "License"); 
 * you may not use this file except in compliance with the License. 
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
;
(function($) {
	//_.T,n,x + s / 2,y,s,color
	//[_.T,_.get('sign'),q,ps,g,j]
	var sign_fn = function(T, si, Q, size, color) {
		var x = Q.x,y = Q.y;
		if(si=='bar'){
			T.box(x-size / 2, y - size / 4, size, size / 2, 0, color);return true;
		}else if(si=='square'){
			T.box(x-size / 2, y - size/ 2, size, size, 0, color);return true;
		}else if(si=='square-hollow'){
			T.box(x-size / 2, y - size/ 2, size, size, 0, color);
			T.box(x-size / 4, y - size/ 4, size/2, size/2, 0, this.get('hollow_color')||'#FEFEFE');
			return true;
		}else if (si == 'round') {
			this.T.round(x, y, size / 2, color);
			return true;
		}else if (si == 'round-hollow') {
			this.T.round(x, y, size*3/8,this.get('hollow_color')||'#FEFEFE',size/4,color);
			return true;
		} else if (si == 'round-bar') {
			this.T.box(x-size/2, y - size / 12, size, size / 6, 0, color);
			this.T.round(x, y, size / 3, color);
			return true;
		} else if (si == 'square-bar') {
			this.T.box(x-size/2, y - size / 12, size, size / 6, 0, color);
			this.T.box(x - size / 4, y - size / 4, size / 2, size / 2, 0, color);return true;
		}else if (si == 'square-bar') {
			this.T.box(x-size/2, y - size / 12, size, size / 6, 0, color);
			this.T.box(x - size / 4, y - size / 4, size / 2, size / 2, 0, color);return true;
		}
		
		return false;

	}

	$.Legend.plugin('sign', sign_fn);
	$.LineSegment.plugin('sign', sign_fn);

})(iChart);
