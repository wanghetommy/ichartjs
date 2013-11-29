/**
 * @overview the legend componment
 * @component#iChart.Legend
 * @extend#iChart.Component
 */
iChart.Legend = iChart.extend(iChart.Component, {
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Legend.superclass.configure.apply(this, arguments);

		/**
		 * indicate the legend's type
		 */
		this.type = 'legend';

		this.set({
			/**
			 * @cfg {Array} Required,The datasource of Legend.Normally,this will given by chart.(default to undefined)
			 */
			data : undefined,
			/**
			 * @inner {Number} Specifies the width.Note if set to 'auto' will be fit the actual width.(default to 'auto')
			 */
			width : 'auto',
			/**
			 * @cfg {Number/String} Specifies the number of column.(default to 1) Note:If set to 'max',the list will be lie on the property row
			 */
			column : 1,
			/**
			 * @cfg {Number/String} Specifies the number of column.(default to 'max') Note:If set to 'max',the list will be lie on the property column
			 */
			row : 'max',
			/**
			 * @cfg {Number} Specifies the limited width.Normally,this will given by chart.(default to 0)
			 */
			maxwidth : 0,
			/**
			 * @cfg {Number} Specifies the lineheight when text display multiline.(default to 16)
			 */
			line_height : 16,
			/**
			 * @cfg {String} Specifies the shape of legend' sign (default to 'square') Available value are:
			 * @Option 'round'
			 * @Option 'square'
			 * @Option 'bar'
			 * @Option 'round-bar'
			 * @Option 'square-bar'
			 */
			sign : 'square',
			/**
			 * @cfg {Number} the size of legend' sign (default to 10)
			 */
			sign_size : 10,
			/**
			 * @cfg {Number} the distance of legend' sign and text (default to 5)
			 */
			sign_space : 5,
			/**
			 * @cfg {Number} Specifies the space between the sign and text.(default to 5)
			 */
			legend_space : 5,
			
			z_index : 1009,
			/**
			 * @cfg {Boolean} If true the text's color will accord with sign's.(default to false)
			 */
			text_with_sign_color : false,
			/**
			 * @cfg {String} Specifies the horizontal position of the legend in chart.(defaults to 'right').Available value are:
			 * @Option 'left'
			 * @Option 'center' Only applies when valign = 'top|bottom'
			 * @Option 'right'
			 */
			align : 'right',
			/**
			 * @cfg {String} this property specifies the vertical position of the legend in an module (defaults to 'middle'). Available value are:
			 * @Option 'top'
			 * @Option 'middle' Only applies when align = 'left|right'
			 * @Option 'bottom'
			 */
			valign : 'middle'
		});

		/**
		 * this element support boxMode
		 */
		this.atomic = true;

		this.registerEvent(
		/**
		 * @event Fires when parse this element'data.Return text value will override existing.
		 * @paramter iChart.Chart#this
		 * @paramter string#text the text will display
		 * @paramter int#i the index of data
		 * @return string
		 */
		'parse');

	},
	isEventValid : function(e,_) {
		var r = {
			valid : false
		},
		h=_.get('line_height');
		if (e.x > this.x && e.x < (_.x + _.width) && e.y > _.y && e.y < (_.y + _.height)) {
			_.data.each(function(d, i) {
				if (e.x > d.x && e.x < (d.x + d.width_ + _.get('signwidth')) && e.y > (d.y -h/2) && e.y < (d.y + h/2)) {
					r = {
						valid : true,
						index : i,
						target : d
					}
					return false;
				}
			}, _);
		}
		return r;
	},
	drawCell : function(x, y, text, color,n,_) {
		var s = _.get('sign_size'),f = _.getPlugin('sign');
		if(!f||!f.call(_,_.T,n,{x:x + s / 2,y:y},s,color)){
			if(n.indexOf("bar")!=-1){
				_.T.box(x, y - s / 12, s, s / 6, 0, color);
			}
			if(n=='round'){
				_.T.round(x + s / 2, y, s / 2, color);
			}else if(n=='round-bar'){
				_.T.round(x + s / 2, y, s / 4, color);
			}else if (n == 'square-bar') {
				_.T.box(x + s / 4, y - s / 4, s / 2, s / 2, 0, color);
			}else if (n == 'square'){
				_.T.box(x, y-s/2, s, s, 0, color);
			}
		}
		_.T.fillText(text, x + _.get('signwidth'), y, 0, _.get('text_with_sign_color')?color:_.get('color'),'lr',_.get('line_height'));
	},
	doDraw : function(_) {
		_.T.box(_.x, _.y, _.width, _.height, _.get('border'), _.get('f_color'), false, _.get('shadow'));
		_.T.textStyle(_.L, 'middle', iChart.getFont(_.get('fontweight'), _.get('fontsize'), _.get('font')));
		_.data.each(function(d) {
			_.drawCell(d.x, d.y, d.text, d.color,d.sign,_);
		});
	},
	doLayout:function(_,g){
		var ss = _.get('sign_size'),
			w = 0,
			h=0, 
			temp = 0, 
			c = _.get('column'),
			r = _.get('row'),
			L = _.data.length;
			c = c>L?L:c;
		_.T.textFont(_.get('fontStyle'));
		
		if (_.get('line_height') < ss) {
			_.push('line_height', ss + ss / 5);
		}
		_.push('signwidth', (ss + _.get('sign_space')));
		/**
		 * calculate the width each item will used
		 */
		_.data.each(function(d) {
			d.width_ = _.T.measureText(d.text);
		}, _);
		
		/**
		 * calculate the each column's width it will used
		 */
		for ( var i = 0; i < c; i++) {
			temp = 0;
			for ( var j = i; j < L; j+=c) {
				temp = Math.max(temp, _.data[j].width_);
			}
			_.columnwidth[i] = temp;
			w += temp;
		}
		/**
		 * calculate the each row's height it will used
		 */
		for ( var i = 0; i < r; i++) {
			temp =0;
			for ( var j = i*c; j < L; j++) {
				temp = Math.max(temp, _.data[j].text.split("\n").length);
			}
			_.columnheight[i] = temp;
			h+=temp;
		}
		w = _.push(_.W, w + _.get('hpadding') + _.get('signwidth') * c + (c - 1) * _.get('legend_space'));
		if (w > _.get('maxwidth')){
			var fs=Math.floor(_.get('fontsize')*(_.get('maxwidth')/w));
			if(!(fs<10&&c==1)){
				if(fs>9){
					_.push('fontStyle',iChart.getFont(_.get('fontweight'), _.push('fontsize', fs), _.get('font')));
				}else if(c>1){
					_.push('row', Math.ceil(L / _.push('column',c-1)));
				}
				_.doLayout(_,g);
				return;
			}
		}
		
		var d,x,y,y2;
		_.width = w;
		
		_.height = h = _.push(_.H, h * _.get('line_height') + _.get('vpadding'));
		
		if (_.get('valign') == _.O) {
			_.y = g.get('t_originy');
		} else if (_.get('valign') == _.B) {
			_.y = g.get('b_originy') - h;
		} else {
			_.y = g.get('centery') - h / 2;
		}
		
		if (_.get('align') == _.L) {
			_.x = g.get('l_originx');
		} else if (_.get('align') == _.C) {
			_.x = g.get('centerx') - w / 2;
		} else {
			_.x = g.get('r_originx') - w;
		}
		
		_.x = _.push(_.X, (_.x<0?g.get('l_originx'):_.x) + _.get('offsetx'));
		_.y = _.push(_.Y, (_.y<0?g.get('t_originy'):_.y) + _.get('offsety'));
		
		
		y = _.y + _.get('padding_top');
		
		ss = _.get('legend_space')+_.get('signwidth');
		/**
		 * calculate the each cell's coordinate point
		 */
		for ( var i = 0; i < r; i++) {
			x = _.x + _.get('padding_left');
			y2=(_.columnheight[i]/2)*_.get('line_height');
			y+=y2;
			for ( var j = 0; j < c&&i*c+j<L; j++) {
				d = _.data[i*c+j];
				d.y = y;
				d.x = x;
				x += _.columnwidth[j] + ss;
			}
			y+=y2;
		}
	},
	doConfig : function() {
		iChart.Legend.superclass.doConfig.call(this);
		
		var _ = this._(),g = _.root,c = iChart.isNumber(_.get('column')),r = iChart.isNumber(_.get('row')), L = _.data.length;
		/**
		 * if the position is incompatible,rectify it.
		 */
		if (_.get('align') == _.C && _.get('valign') == 'middle') {
			_.push('valign', _.O);
		}

		/**
		 * if this position incompatible with root,rectify it.
		 */
		if (g.get('align') == _.L) {
			if (_.get('valign') == 'middle') {
				_.push('align', _.R);
			}
		}
		
		/**
		 * calculate the width each item will used
		 */
		_.data.each(function(d, i) {
			iChart.merge(d, _.fireEvent(_, 'parse', [_, d.name, i]));
			d.text = d.text || d.name ||'';
			d.sign = d.sign || _.get('sign')
		}, _);
		
		if (!c && !r)
			c = _.push('column',1);
		if (c && !r)
			r = _.push('row', Math.ceil(L / _.get('column')));
		if (!c && r)
			c = _.push('column', Math.ceil(L / _.get('row')));

		c = _.get('column');
		r = _.get('row');
		
		if (L > r * c) {
			r += Math.ceil((L - r * c) / c);
			r = _.push('row', r);
		}
		_.columnwidth = [];
		_.columnheight = [];
		
		_.doLayout(_,g);
		
	}
});/** @end */
