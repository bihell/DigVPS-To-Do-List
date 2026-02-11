#!/bin/bash

# --- 颜色定义 ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_NAME="stark-todo-list"

# --- 逻辑封装 ---

function do_stop() {
    printf "${YELLOW}正在停止 STARK Todo List...${NC}\n"

    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
        pm2 stop "$APP_NAME" >/dev/null 2>&1
        pm2 delete "$APP_NAME" >/dev/null 2>&1
        printf "${GREEN}已停止应用${NC}\n"
    else
        # 兜底：查找并杀死占用 3001 端口的所有 Node 进程
        PORT_PIDS=$(lsof -t -i:3001 2>/dev/null)
        if [ -n "$PORT_PIDS" ]; then
            for P in $PORT_PIDS; do
                kill -9 $P >/dev/null 2>&1
            done
            printf "${YELLOW}已释放端口 3001${NC}\n"
        else
            printf "${YELLOW}应用未在运行${NC}\n"
        fi
    fi
}

function do_build() {
    printf "${BLUE}正在安装依赖...${NC}\n"
    $PM install > /dev/null 2>&1

    printf "${BLUE}正在编译应用...${NC}\n"
    $PM run build

    if [ $? -ne 0 ]; then
        printf "${RED}编译失败${NC}\n"
        return 1
    fi
    printf "${GREEN}编译完成${NC}\n"
    return 0
}

function do_start() {
    # 检查应用是否已在 pm2 中运行
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
        printf "${YELLOW}应用已经在运行中，请使用 restart 重启${NC}\n"
        return 0
    fi

    # 检查端口占用
    PORT_PID=$(lsof -t -i:3001 2>/dev/null)
    if [ -n "$PORT_PID" ]; then
        printf "${RED}错误: 端口 3001 已被占用，尝试执行 stop 后再启动${NC}\n"
        return 1
    fi

    do_build || return 1

    printf "${GREEN}使用 PM2 启动生产服务器...${NC}\n"
    # 使用 pm2 启动生产服务器
    pm2 start "$PM" --name "$APP_NAME" -- start

    sleep 2
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
        printf "${GREEN}启动成功！访问: http://localhost:3001${NC}\n"
        printf "${BLUE}提示: 使用 'pm2 logs $APP_NAME' 查看日志${NC}\n"
    else
        printf "${RED}启动失败，请使用 'pm2 logs $APP_NAME' 查看日志${NC}\n"
    fi
}

function do_dev() {
    # 检查应用是否已在 pm2 中运行
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
        printf "${YELLOW}应用已经在运行中，请先停止${NC}\n"
        return 0
    fi

    # 检查端口占用
    PORT_PID=$(lsof -t -i:3001 2>/dev/null)
    if [ -n "$PORT_PID" ]; then
        printf "${RED}错误: 端口 3001 已被占用，尝试执行 stop 后再启动${NC}\n"
        return 1
    fi

    printf "${BLUE}正在安装依赖...${NC}\n"
    $PM install > /dev/null 2>&1

    printf "${GREEN}使用 PM2 启动开发服务器...${NC}\n"
    # 使用 pm2 启动开发服务器
    pm2 start "$PM" --name "$APP_NAME" -- run dev

    sleep 2
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
        printf "${GREEN}开发服务器启动成功！访问: http://localhost:3001${NC}\n"
        printf "${BLUE}提示: 使用 'pm2 logs $APP_NAME' 查看日志${NC}\n"
    else
        printf "${RED}启动失败，请使用 'pm2 logs $APP_NAME' 查看日志${NC}\n"
    fi
}

# --- 初始化 ---
if [ ! -f "todos.json" ]; then
    echo "[]" > todos.json
    printf "${YELLOW}已创建初始数据文件 todos.json${NC}\n"
fi

# 检查 PM2 是否安装
if ! command -v pm2 >/dev/null 2>&1; then
    printf "${RED}错误: PM2 未安装${NC}\n"
    printf "${YELLOW}请先安装 PM2: npm install -g pm2${NC}\n"
    exit 1
fi

# 检查包管理器
if command -v pnpm >/dev/null 2>&1; then
    PM="pnpm"
else
    PM="npm"
fi

case "$1" in
    build)
        do_build
        ;;
    start)
        do_start
        ;;
    dev)
        do_dev
        ;;
    stop)
        do_stop
        ;;
    restart)
        printf "${BLUE}正在执行彻底重启...${NC}\n"
        do_stop
        sleep 1
        printf "${BLUE}清理编译缓存...${NC}\n"
        rm -rf .next
        do_start
        ;;
    logs)
        if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
            pm2 logs "$APP_NAME"
        else
            printf "${RED}应用未在运行${NC}\n"
        fi
        ;;
    status)
        if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
            pm2 describe "$APP_NAME"
        else
            printf "${RED}应用未运行${NC}\n"
        fi
        ;;
    clean)
        printf "${BLUE}清理缓存...${NC}\n"
        rm -rf .next
        printf "${GREEN}清理完成${NC}\n"
        ;;
    *)
        printf "${BLUE}STARK Todo List 本地管理脚本 (PM2)${NC}\n"
        echo "用法: $0 [build|start|dev|stop|restart|logs|status|clean]"
        echo ""
        echo "命令说明:"
        echo "  build   - 仅编译应用 (不启动)"
        echo "  start   - 编译并启动生产服务器"
        echo "  dev     - 启动开发服务器 (不编译)"
        echo "  stop    - 停止应用"
        echo "  restart - 重启应用并清理缓存"
        echo "  logs    - 查看应用日志"
        echo "  status  - 查看应用状态"
        echo "  clean   - 清理 .next 缓存"
        exit 1
        ;;
esac
