const Koa = require('koa')
const fs = require('fs')
const path = require('path')
const compilerSFC = require('@vue/compiler-sfc')
const compilerDOM = require('@vue/compiler-dom')

const app = new Koa()

app.use(async (ctx)=>{
  const {url,query} = ctx.request
  if(url === `/`){
    ctx.type = `text/html`
    ctx.body = fs.readFileSync(path.join(__dirname,'./index.html'),'utf-8')
  }else if(url.endsWith(`.js`)){
    const filePath = path.join(__dirname,url)
    ctx.type = `application/javascript`
    ctx.body = rewriteImport(fs.readFileSync(filePath,'utf-8'))
  }else if(url.startsWith(`/@modules/`)){

    // 裸模块名称
    const moduleName = url.replace(`/@modules/`,``)
    const prefix = path.join(__dirname,`./node_modules`,moduleName)

    const module = require(prefix + `/package.json`).module
    const filePath = path.join(prefix,module)

    ctx.type = `application/javascript`
    ctx.body = rewriteImport(fs.readFileSync(filePath,'utf-8'))
  }else if(url.indexOf(`.vue`) > -1){
    // 获取加载文件路径
    const filePath = path.join(__dirname,url.split(`?`)[0])
    const ret = compilerSFC.parse(fs.readFileSync(filePath,'utf-8'))
    if(!query.type){
      // sfc请求 读取vue文件，解析为js
      const scriptContent = ret.descriptor.script.content
      const script = scriptContent.replace(`export default `,`const __script =`)

      ctx.type = `application/javascript`
      ctx.body = `
        ${rewriteImport(script)}
        // 解析tpl
        import {render as __render} from '${url}?type=template'
        __script.render = __render
        export default __script
      `
    }else if(query.type === `template`){

      const tpl = ret.descriptor.template.content
      // 编译为render 
      const render = compilerDOM.compile(tpl,{mode:`module`}).code

      ctx.type = 'application/javascript'
      ctx.body = rewriteImport(render)
    }
  }
  // ctx.body = `hello kvite~`
})

// 裸地址重写
// import xx from vue ==> import xx from '/@modules/vue'
const rewriteImport = content => {
  return content.replace(/ from ['"](.*)['"]/g,(s1,s2)=>{
    if(s2.startsWith(`./`) || s2.startsWith(`/`) || s2.startsWith(`../`)){
      return s1
    }else {
      return ` from '/@modules/${s2}'`
    }
  })
}

app.listen(4000,()=>{
  console.log(`kvite setup at :4000`)
})