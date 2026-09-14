/*!
 * simple ichartjs ajax Plugin use jQuery
 * version: 1.0
 * @requires ichartjs v1.0 or later,jquery
 * @site http://www.ichartjs.com/
 * @author wanghe
 * @Copyright 2012-2022 
 * wanghetommy@gmail.com 
 */
iChart.override(iChart.Chart, {
	ajax : function(URL,f) {
		jQuery.ajax({
		  type: 'POST',
		  url: URL,
		  dataType: 'json',
		  success: function(d){
			f(d);
		  },
		  error: function(){
			
		  }
		});
	}
});