var LazyBlockGenerator = (function(){
  function LazyBlockGenerator(style, block){
    LayoutGenerator.call(this, style, null);
    this.block = block;
  }
  Class.extend(LazyBlockGenerator, LayoutGenerator);

  LazyBlockGenerator.prototype.yield = function(context){
    if(this._terminate){
      return null;
    }
    this._terminate = true; // yield only once.
    return this.block;
  };

  return LazyBlockGenerator;
})();
