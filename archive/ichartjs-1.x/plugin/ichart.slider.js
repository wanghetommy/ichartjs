/**
 * @overview the slider componment
 * @component#iChart.Slider
 * @extend#iChart.Component
 */
iChart.Slider = iChart.extend(iChart.Component, {
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Slider.superclass.configure.apply(this, arguments);
		/**
		 * indicate the component's type
		 */
		this.type = 'slider';

		this.set({
			height : 50,
			margin : 30,
			slider : {
				width : 20,
				height : 20,
				border : {
					enable:true,
					color:'#aaaaaa',
					width:1,
					radius : 4
				},
				background_color : '#eaeaea'
			},
			border:{
				color:'#6fcef6'
			},
			slider_margin_bottom:4,
			axis:{
				height : 6,
				background_color : '#3391ba'
			},
			value : {
				left : 40,
				right : 100
			},
			background_color:'#fefefe',
			minSliderDistance : 60,
			onPositionChanged : function(changeToValue) {
				 //console.log('left = ' + changeToValue.left + ',right = ' + changeToValue.right);
			},
			touchFaultTolerance : 10
		});
		
		this.registerEvent();
	},
	 setLeft: function (x) {
        if (x < 0){ 
        	x = 0;
        }else if (this.right - x  < this.minSliderDistance){
        	x = this.right - this.minSliderDistance;
        }
        this.left = x<0?0:x;
        this.value.left = this.left * 100 /this.width;
        this.region.x1 = this.region.x + this.left;
    },
    setRight: function (x) {
        if (x < this.left + this.minSliderDistance){
        	this.right = this.left + this.minSliderDistance;
        } 
        else if (x > this.width){
        	this.right = this.width;
        }
        else{
        	this.right = x;
        }
        this.value.right = this.right * 100 /this.width;
        this.region.x2 = this.region.x + this.right;
    },
	doDraw : function(_) {
    	var w = this.slider.width;
        this.T.clearRect(this.x-w / 2-1, this.y-1, this.width+w+2, this.height+2);
        
        this.T.box(this.x, this.y, this.width,this.height,this.get('border'),this.get('f_color'),this.get('shadow'),1);
        this.push('shadow',false);
        
        this.T.box(this.x, this.y+this.pHeight, this.width,this.axis.height,0,this.axis.background_color);
        
        this.T.box(this.x + this.left, this.y, this.right - this.left, this.pHeight,0,this.lightcolor);
        
        this.darwSlider(this.region,this.region.x1,w);
        this.darwSlider(this.region,this.region.x2,w);
	},
	darwSlider:function(r,x,w){
    	this.T.box(x,r.y,r.width, r.height,this.slider.border,this.slider.background_color);
        this.T.line(x+w*3/8,r.y+4, x+w*3/8, r.y+r.height-4, 1, this.slider.border.color);
        this.T.line(x+w*5/8,r.y+4, x+w*5/8, r.y+r.height-4, 1, this.slider.border.color);
    },
	isEventValid : function(e,_) {
		return {valid:e.x>(_.x-+_.slider.width/2)&&e.x<(_.x+_.width+_.slider.width/2)&&e.y<(_.y+_.height)&&e.y>(_.y)};
	},
	position:function(x,y,w,h){
		var _ = this._();
		_.x =  _.push(_.X,x);
		_.y =  _.push(_.Y,y+ _.get('margin'));
		if(w)
		_.push(_.W,w)
		if(h)
		_.push(_.H,h)
		_.doLayut(_);
	},
	doLayut:function(_){
		_.width =  _.get(_.W);
	    _.height =  _.get(_.H);
	    _.pHeight = _.height - (_.slider.height+_.axis.height)/2-_.get('slider_margin_bottom');
	    _.left =  _.value.left * (_.width) / 100;
        _.right =  _.value.right * (_.width) / 100;
        _.region = {x: _.x - _.slider.width / 2-(iChart.touch?_.touchTolerance:0),y: _.y + _.pHeight +_.axis.height/2 - _.slider.height / 2, width: _.slider.width+(iChart.touch?_.touchTolerance:0), height: _.slider.height};
        _.region.x1 = _.region.x + _.left;
        _.region.x2 = _.region.x + _.right;
	},
	Height:function(){
		return this.get('height')+this.get('margin')
	},
	doConfig : function(){
		iChart.Slider.superclass.doConfig.call(this);
		var _ = this._();
		
		/**
		 * this element not atomic because it is a container,so this is a particular case.
		 */
		_.atomic = false;
		
		this.canvas = _.T.canvas;
	    
	    this.slider = _.get('slider');
		this.axis = _.get('axis');
		this.value = _.get('value');
	    this.y =  _.y + this.get('margin');
	    
	    if(this.get('height')-this.slider.height<20){
	    	this.push('height',this.slider.height+20);
	    }
	    if(this.axis.height*2>this.get('height')){
	    	_.push('axis.height',this.get('height')/2);
	    }
	    var l = this.value.left,r = this.value.right;
	    if(l<0||l>100){
	    	this.value.left=0;
	    }
	    if(r<0||r>100){
	    	this.value.right=100;
	    }
	    
	    if(this.get('width'))
	    this.doLayut(_);
	    
	    this.lightcolor = iChart.toRgba('#e2f0ff',0.8);
	    
		this.minSliderDistance = _.get('minSliderDistance')+this.slider.width;
		
		this.onPositionChanged = null;//_.get('onPositionChanged');
		this.isTouchDevice = iChart.touch;
		this.touchTolerance = _.get('touchFaultTolerance');
		
		this.addControllerEvents();
	},
    addControllerEvents: function () {
        var _ = this._();
        var moveHandle = function (e) {
            var inLeft = _.inLeft(e,_);
            var inRight = _.inRight(e,_);
            if (_.inLeftAndRight(e,_)) {
                document.body.style.cursor = 'pointer';
            } else if (inLeft || inRight || _.triggerBar) {
                document.body.style.cursor = 'col-resize';
            }
            else {
                document.body.style.cursor = 'default';
            }
            if (_.triggerBar) {
                _.triggerBar.targetX = e.offsetX;
                var moveLength = (_.triggerBar.targetX - _.triggerBar.x);
                if (_.triggerBar.type == 'left') {
                    document.body.style.cursor = 'col-resize';
                    _.setLeft(_.triggerBar.position + moveLength);
                } else if (_.triggerBar.type == 'right') {
                    _.setRight(_.triggerBar.position + moveLength);
                } else {
                    _.setLeft(_.triggerBar.leftPosition + moveLength);
                    _.setRight(_.triggerBar.rightPosition + moveLength);
                }
                
                if (typeof _.onPositionChanged == 'function' && _.isValueChanged()) {
                    _.onPositionChanged(_.value);
                }
                _.doDraw(_);
            }
        };
        var endMove = function (e) {
            if (_.triggerBar) {
            }
            _.triggerBar = null;
            document.body.style.cursor = 'default';
            if (typeof _.onPositionChanged == 'function' && _.isValueChanged()) {
                _.onPositionChanged(_.value);
                //console.log('_.onPositionChanged(_.value) _.value is {left:' + _.value.left + ',right:' + _.value.right + '}');
            }
        };

        var startHandle = function (e) {
            if (_.inLeft(e,_)) _.triggerBar = { type: 'left', x: e.offsetX, position: _.left };
            else if (_.inRight(e,_)) _.triggerBar = { type: 'right', x: e.offsetX, position: _.right };
            else if (_.inLeftAndRight(e,_)) _.triggerBar = { type: 'middle', x: e.offsetX, leftPosition: _.left, rightPosition: _.right };
            else _.triggerBar = null;

        };
        
        iChart.Event.addEvent(_.canvas, 'mouseup', endMove);
        iChart.Event.addEvent(_.canvas, 'mouseout', endMove);
        
        this.on('mousemove', function(C,e, M) {
            if (e.preventDefault) e.preventDefault();
            else e.returnValue = false;
            moveHandle(iChart.Event.fix(e));
		});
        
        iChart.Event.addEvent(_.canvas, 'mousedown', function (ev) {
            ev = ev || event;
            startHandle(iChart.Event.fix(ev));
        });
    },
    isValueChanged: function () {
        if (typeof this.preValue == 'undefined') {
            this.preValue = this.getValue();
            return false;
        }

        if (iChart.touch && this.latestChangeTime) {
            var now = new Date();
            if (now.getTime() - this.latestChangeTime.getTime() < 50) return false;
        }
        var preValue = this.preValue;
        var value = this.getValue();
        var changed = Math.abs(value.left - preValue.left) + Math.abs(value.right - preValue.right);
        this.preValue = value;
        var result = changed != 0;
        if (result) {
            this.latestChangeTime = new Date();
        }
        return changed != 0;
    },
    inRegion: function (e, region,x) {
        return e.offsetX > x && e.offsetX < x + region.width
          && e.offsetY > region.y && e.offsetY < region.y + region.height;
    },
    inLeftAndRight: function (e,_){
        return _.inRegion(e, {
            y: _.y,
            width: _.right - _.left - _.slider.width,
            height: _.height
        },_.x + _.left + _.slider.width / 2);
    },
    inLeft: function (e,_) {
        return _.inRegion(e,_.region,_.region.x1);
    },
    inRight: function (e,_) {
        return _.inRegion(e,_.region,_.region.x2);
    },
    getValue: function (_) {
        var totalLength = _.width - _.slider.width;
        return {
            left: (_.left - _.slider.width / 2) * 100 / totalLength,
            right: (_.right - _.slider.width / 2) * 100 / totalLength
        };
    }
});
/**
 * @end
 */
