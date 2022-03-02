// 实现这个项目的构建任务
const { src, dest, parallel, series, watch } = require("gulp");
const del = require("del");
const loadPlugins = require("gulp-load-plugins");
const plugins = loadPlugins();
const browserSync = require("browser-sync");
const bs = browserSync.create();
// 使用 load-plugins 简化导入后删除以下
const sass = require("gulp-sass")(require("node-sass"));
// const swig = require("gulp-swig");
// const babel = require("gulp-babel");
// const imagemin = require("gulp-imagemin");

// const data = require("./data");
const cwd = process.cwd();
let config = {
  // default config
  build: {
    src: "src",
    dist: "dist",
    temp: "temp",
    public: "public",
    paths: {
      styles: "assets/styles/*.scss",
      pages: "*.html",
      scripts: "assets/scripts/*.js",
      images: "assets/images/**",
      fonts: "assets/fonts/**",
    },
  },
};
try {
  const loadConfig = require(`${cwd}/pages.config.js`);
  config = Object.assign({}, config, loadConfig);
} catch (e) {}

const clean = () => {
  return del([config.build.dist, config.build.temp]);
};

const style = () => {
  return (
    src(config.build.paths.styles, {
      base: config.build.src,
      cwd: config.build.src,
    }) // base:基准路径, 添加 cwd属性,从 cwd 指定目录开始找,相当于拼接
      .pipe(sass({ outputStyle: "expanded" })) // 完全展开
      // sass() 转换后,最终只生成没有_开头的文件,_的文件作为依赖文件
      .pipe(dest(config.build.temp))
      .pipe(bs.reload({ stream: true }))
  ); // 推送流到服务器
};

const page = () => {
  return src(config.build.paths.pages, {
    base: config.build.src,
    cwd: config.build.src,
  })
    .pipe(plugins.swig({ data: config.data, defaults: { cache: false } })) // 防止缓存造成不更新 此处 data 已更新
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }));
};

const script = () => {
  return src(config.build.paths.scripts, {
    base: config.build.src,
    cwd: config.build.src,
  })
    .pipe(plugins.babel({ presets: [require("@babel/preset-env")] })) // babel 只是ECMAScript 转换平台,此处需指定使用插件做转换,preset-env 是 es 所有最新特性的集合
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }));
};

const image = () => {
  return src(config.build.paths.images, {
    base: config.build.src,
    cwd: config.build.src,
  })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist));
};

const font = () => {
  return src(config.build.paths.fonts, {
    base: config.build.src,
    cwd: config.build.src,
  })
    .pipe(plugins.imagemin()) //无法转换的内容直接复制
    .pipe(dest(config.build.dist));
};

const extra = () => {
  return src("**", {
    base: config.build.public,
    cwd: config.build.public,
  }).pipe(dest(config.build.dist));
};

const serve = () => {
  watch(config.build.paths.styles, { cwd: config.build.src }, style);
  watch(config.build.paths.scripts, { cwd: config.build.src }, script);
  watch(config.build.paths.pages, { cwd: config.build.src }, page);
  // watch("src/assets/images/**", image); // 会降低开发阶段构建效率
  // watch("src/assets/fonts/**", font);
  // watch("public/**", extra);
  watch(
    [config.build.paths.images, config.build.paths.fonts],
    { cwd: config.build.src },
    bs.reload
  );
  watch("**", { cwd: config.build.public }, bs.reload);

  bs.init({
    notify: false, // 关闭可能造成影响的提示
    port: 2080,
    //open:false // 启动后自动打开浏览器
    // files: "dist/**", // 监听的文件,使用 bs.reload 后就不需要该参数
    server: {
      // baseDir: "dist", // 项目根目录
      baseDir: [config.build.temp, config.build.dist, config.build.public], // 按顺序切换根目录查找资源,
      routes: {
        "/node_modules": "node_modules",
      },
    },
  });
};

// 上线前的工作
const useref = () => {
  return src(config.build.paths.pages, {
    base: config.build.temp,
    cwd: config.build.temp,
  })
    .pipe(plugins.useref({ searchPath: [config.build.temp, "."] })) //指定路径,转换构建注释时使用
    .pipe(plugins.if(/\.js$/, plugins.uglify()))
    .pipe(plugins.if(/\.css$/, plugins.cleanCss()))
    .pipe(
      plugins.if(
        /\.html$/,
        plugins.htmlmin({
          collapseWhitespace: true, //折叠所有空白字符和换行符
          minifyCSS: true,
          minifyJS: true, // 自动压缩<style><script>标签中的内容
          removeComments: true, //删除 html 注释
        })
      )
    )
    .pipe(dest(config.build.dist)); // 防止读写冲突
};
// const compile = parallel(style, script, page, image, font);
// const build = series(clean, parallel(compile, extra));
// 优化后:
const compile = parallel(style, script, page);
const build = series(
  clean,
  parallel(series(compile, useref), image, font, extra)
);
const develop = series(compile, serve);
module.exports = {
  clean,
  // compile,
  build,
  // serve,
  develop,
  // useref,
};
