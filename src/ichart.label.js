/**
 * @overview the label componment
 * @component#iChart.Label
 * @extend#iChart.Component
 */
iChart.Label = iChart.extend(iChart.Component, {
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Label.superclass.configure.apply(this, arguments);

		/**
		 * indicate the legend's type
		 */
		this.type = 'label';

		this.set({
			/**
			 * @cfg {String} Specifies the text of this label,Normally,this will given by chart.(default to '').
			 */
			text : '',
			/**
			 * @cfg {Number} Specifies the lineheight when text display multiline.(default to 12).
			 */
			line_height : 12,
			/**
			 * @cfg {Number} Specifies the thickness of line in pixel.(default to 1).
			 */
			line_thickness : 1,
			/**
			 * @cfg {String} Specifies the shape of legend' sign (default to 'square').Available value are:
			 * @Option 'round'
			 * @Option 'square'
			 */
			sign : 'square',
			/**
			 * @cfg {Number} Specifies the size of legend' sign in pixel.(default to 12)
			 */
			sign_size : 12,
			/**
			 * @cfg {Number} Override the default as 2 in pixel.
			 */
			padding : '2 5',
			/**
			 * @cfg {Number} Override the default as 2 in pixel.
			 */
			offsety : 2,
			/**
			 * @cfg {Number} Specifies the space between the sign and text.(default to 5)
			 */
			sign_space : 5,
			/**
			 * @cfg {Number} Override the default as '#efefef'.
			 */
			background_color : '#efefef',
			/**
			 * @cfg {Boolean} If true the text's color will accord with sign's.(default to false)
			 */
			text_with_sign_color : false
		});

		/**
		 * this element support boxMode
		 */
		this.atomic = true;

		this.registerEvent();

	},
	isEventValid : function(e,_) {
		return {
			valid : iChart.inRange(_.labelx, _.labelx + _.get(_.W), e.x) && iChart.inRange(_.labely, _.labely + _.get(_.H), e.y)
		};
	},
	text : function(text) {
		if (text)
			this.push('text', text);
		this.push(this.W, this.T.measureText(this.get('text')) + this.get('hpadding') + this.get('sign_size') + this.get('sign_space'));
	},
	localizer : function(_) {
		var Q = _.get('quadrantd'),p = _.get('line_points'),m=_.get('smooth'),Q=(Q >= 1 && Q <= 2),x=_.get('labelx'),y=_.get('labely');
		_.labelx = x+(Q ? - _.get(_.W)-m : m);
		_.labely = y-_.get(_.H)/2;
		p[2] = {x:x,y:y};
		p[3] = {x:p[2].x+(Q ? -m : m),y:p[2].y};
	},
	doLayout : function(x, y,n,_) {
		_.push('labelx', _.get('labelx') + x/n);
		_.push('labely', _.get('labely') + y/n);
		
		_.get('line_points').each(function(p,i) {
			p.x += x;
			p.y += y;
			return i==1;
		}, _);
		_.localizer(_);
	},
	doDraw : function(_){
		var p = _.get('line_points'), ss = _.get('sign_size'), x = _.labelx + _.get('padding_left'), y = _.labely + _.get('padding_top');
		
		_.T.label(p, _.get('line_thickness'), _.get('border.color'));
		
		_.T.box(_.labelx, _.labely, _.get(_.W), _.get(_.H), _.get('border'), _.get('f_color'), false, _.get('shadow'));

		_.T.textStyle(_.L, _.O, _.get('fontStyle'));

		var textcolor = _.get('color');
		if (_.get('text_with_sign_color')) {
			textcolor = _.get('scolor');
		}
		if (_.get('sign') == 'square') {
			_.T.box(x, y, ss, ss, 0, _.get('scolor'));
		} else if(_.get('sign')){
			_.T.round(x + ss / 2, y + ss / 2, ss / 2, _.get('scolor'));
		}
		_.T.fillText(_.get('text'), x + ss + _.get('sign_space'), y, _.get('textwidth'), textcolor);
	},
	doConfig : function() {
		iChart.Label.superclass.doConfig.call(this);
		var _ = this._();

		_.T.textFont(_.get('fontStyle'));

		if (_.get('fontsize') > _.get('line_height')) {
			_.push('line_height', _.get('fontsize'));
		}
		if(!_.get('sign')){
			_.push('sign_size',0);
			_.push('sign_space',0);
		}
		_.push(_.H, _.get('line_height') + _.get('vpadding'));

		_.text();

		_.localizer(_);

	}
});
/**
 * @end
 */
