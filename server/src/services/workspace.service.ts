import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('workspace');

export interface WorkspaceInfo {
  id: string;
  path: string;
  name: string;
}

export interface RootConfig {
  workspaces: WorkspaceInfo[];
}

export class WorkspaceService {
  private readonly rootDir = path.join(os.homedir(), '.context_tool_data');
  private readonly rootJson = path.join(this.rootDir, 'root.json');

  private async ensureRootDir() {
    await fs.ensureDir(this.rootDir);
    if (!(await fs.pathExists(this.rootJson))) {
      await fs.writeJson(this.rootJson, { workspaces: [] });
    }
  }

  private async getConfig(): Promise<RootConfig> {
    await this.ensureRootDir();
    try {
      const config = await fs.readJson(this.rootJson);
      if (!config || !Array.isArray(config.workspaces)) {
        throw new Error('Invalid config format');
      }
      return config;
    } catch (err) {
      logger.error('Error reading root.json, resetting:', err);
      const defaultConfig: RootConfig = { workspaces: [] };
      await fs.writeJson(this.rootJson, defaultConfig, { spaces: 2 });
      return defaultConfig;
    }
  }

  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    const config = await this.getConfig();
    return config.workspaces;
  }

  async findOrCreateWorkspace(folderPath: string): Promise<WorkspaceInfo> {
    const absolutePath = path.resolve(folderPath);
    const config = await this.getConfig();

    let workspace = config.workspaces.find((w) => w.path === absolutePath);
    if (!workspace) {
      const id = crypto.createHash('md5').update(absolutePath).digest('hex');
      const name = path.basename(absolutePath);
      workspace = { id, path: absolutePath, name };
      config.workspaces.push(workspace);
      await fs.writeJson(this.rootJson, config, { spaces: 2 });
    }

    const contextDir = path.join(this.rootDir, 'projects', workspace.id);
    await fs.ensureDir(contextDir);

    const workspaceMd = path.join(contextDir, 'workspace.md');
    const rulesMd = path.join(contextDir, 'workspace_rules.md');

    if (!(await fs.pathExists(workspaceMd))) {
      const template = `# ${workspace.name}\n\n## ℹ️ Information\n- **Project Name:** ${workspace.name}\n- **Main Language:** \n- **Tools:** \n- **Packages:** \n- **Services:** \n- **Goals:** \n- **Key Features:** \n\n## 📂 Directory Structure\nNULL\n`;
      await fs.writeFile(workspaceMd, template);
    }
    if (!(await fs.pathExists(rulesMd))) {
      await fs.writeFile(rulesMd, '');
    }

    return workspace;
  }

  async getContextFiles(
    id: string,
  ): Promise<{ workspace: string; rules: string }> {
    const contextDir = path.join(this.rootDir, 'projects', id);
    const workspaceMd = path.join(contextDir, 'workspace.md');
    const rulesMd = path.join(contextDir, 'workspace_rules.md');

    const workspace = (await fs.pathExists(workspaceMd))
      ? await fs.readFile(workspaceMd, 'utf8')
      : '';
    const rules = (await fs.pathExists(rulesMd))
      ? await fs.readFile(rulesMd, 'utf8')
      : '';

    return { workspace, rules };
  }

  async updateContextFile(
    id: string,
    type: 'workspace' | 'rules',
    content: string,
  ): Promise<void> {
    const contextDir = path.join(this.rootDir, 'projects', id);
    const fileName =
      type === 'workspace' ? 'workspace.md' : 'workspace_rules.md';
    const filePath = path.join(contextDir, fileName);

    await fs.ensureDir(contextDir);
    await fs.writeFile(filePath, content, 'utf8');
  }

  async unlinkWorkspace(id: string): Promise<void> {
    const config = await this.getConfig();
    config.workspaces = config.workspaces.filter((w) => w.id !== id);
    await fs.writeJson(this.rootJson, config, { spaces: 2 });
  }

  async getConversationSummary(
    workspaceId: string,
    conversationId: string,
  ): Promise<string> {
    const contextDir = path.join(this.rootDir, 'projects', workspaceId);
    const summaryFile = path.join(contextDir, `summary_${conversationId}.md`);
    if (await fs.pathExists(summaryFile)) {
      return await fs.readFile(summaryFile, 'utf8');
    }
    return '';
  }

  async updateConversationSummary(
    workspaceId: string,
    conversationId: string,
    content: string,
  ): Promise<void> {
    const contextDir = path.join(this.rootDir, 'projects', workspaceId);
    const summaryFile = path.join(contextDir, `summary_${conversationId}.md`);
    await fs.ensureDir(contextDir);
    await fs.writeFile(summaryFile, content, 'utf8');
  }

  async createSessionFile(
    workspaceId: string,
    conversationId: string,
    data: any,
  ): Promise<void> {
    const contextDir = path.join(this.rootDir, 'projects', workspaceId);
    const sessionsDir = path.join(contextDir, 'sessions');
    await fs.ensureDir(sessionsDir);
    const sessionFile = path.join(sessionsDir, `${conversationId}.json`);
    await fs.writeJson(sessionFile, data, { spaces: 2 });
  }

  async getSessions(workspaceId: string): Promise<any[]> {
    const contextDir = path.join(this.rootDir, 'projects', workspaceId);
    const sessionsDir = path.join(contextDir, 'sessions');

    if (!(await fs.pathExists(sessionsDir))) {
      return [];
    }

    const files = await fs.readdir(sessionsDir);
    const sessions = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          try {
            const filePath = path.join(sessionsDir, file);
            const stats = await fs.stat(filePath);
            const sessionData = await fs.readJson(filePath);

            let taskName = 'Untitled Task';
            let model = 'Unknown Model';
            let totalTokens = 0;
            let messageCount = 0;
            let conversationId = file.replace('.json', '');

            if (sessionData) {
              model = sessionData.model || model;
              totalTokens = sessionData.totalTokens || 0;
              if (Array.isArray(sessionData.messages)) {
                messageCount = sessionData.messages.filter(
                  (m: any) => m.role === 'user',
                ).length;
              }

              if (sessionData.taskName) {
                taskName = sessionData.taskName;
              } else if (
                sessionData.taskProgress &&
                sessionData.taskProgress.current
              ) {
                taskName = sessionData.taskProgress.current.taskName;
              } else if (
                sessionData.taskProgress &&
                Array.isArray(sessionData.taskProgress.history) &&
                sessionData.taskProgress.history.length > 0
              ) {
                const history = sessionData.taskProgress.history;
                taskName = history[history.length - 1].taskName;
              }
              if (sessionData.conversationId) {
                conversationId = sessionData.conversationId;
              }
            }

            return {
              id: conversationId,
              sessionId: conversationId,
              conversationId,
              name: taskName,
              path: filePath,
              createdAt: stats.birthtime,
              lastModified: stats.mtime,
              messageCount,
              model,
              totalTokens,
            };
          } catch (e) {
            logger.error(`Error parsing session file ${file}:`, e);
            return null;
          }
        }),
    );

    return sessions
      .filter((s) => s !== null)
      .sort(
        (a: any, b: any) => b.lastModified.getTime() - a.lastModified.getTime(),
      );
  }
}

export const workspaceService = new WorkspaceService();
