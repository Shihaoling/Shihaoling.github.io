// Personal content lives here. Add entries to the arrays to extend the site.
// Empty links are intentionally not rendered as clickable buttons.
export const profile = {
  name: '史昊灵',
  englishName: 'Haoling Shi',
  currentBase: '长沙',
  email: 'Shihaoling@foxmail.com',
  github: 'https://github.com/Shihaoling',
  resume: '',
  updated: '2026.10',
  intro: '主要研究车机协同路径规划，实习涉及数据分析、金融风控与互联网安全。',
  education: [
    { school: '国防科技大学', en: 'National University of Defense Technology', period: '2024.09 — 至今', degree: '工学硕士 · 在读', major: '管理科学与工程', faculty: '系统工程学院', note: '关注运筹优化、协同调度与智能优化算法。', mark: '01' },
    { school: '西南财经大学', en: 'Southwestern University of Finance and Economics', period: '2020.09 — 2024.06', degree: '本科', major: '信息管理与信息系统', faculty: '特拉华数据科学学院', note: '学习信息管理、数据库及数据分析等相关课程。', mark: '02' },
  ],
  experiences: [
    { id: 'pingan', company: '平安银行', fullName: '平安银行信用卡中心', role: '橙光实习生', department: '消费信贷部 · 消费分期室', period: '2026.06 — 2026.08', summary: '经营指标分析与日报自动化', description: '参与信用卡经营指标提取、跟踪与分析，使用 Python 与 SQL 处理业务数据。', points: ['使用 Python 实现业务日报自动化，整理并输出日常经营数据。', '通过 SQL 支持业务取数、指标核验与分析。', '跟踪经营指标变化，整理业务分析结果。'], tags: ['Python', 'SQL', '数据分析', '流程自动化'] },
    { id: 'vivo', company: 'vivo', fullName: 'vivo 维沃移动通信有限公司', role: '互联网安全算法工程师（实习）', department: '互联网基础平台部', period: '2026.02 — 2026.05', summary: '异常检测与风险预测', description: '参与广告流量异常检测、未成年退款风险预测和黑灰产账号挖掘。', points: ['参与广告联盟流量的模拟点击检测、矩形区域监测及效果评估。', '开展未成年退款比例回归与客诉升级风险概率预测。', '设计 SynchroTrap + LPA 联合框架，支持可疑账户的自动扩线。'], tags: ['异常检测', '风险预测', '图挖掘', '机器学习'] },
    { id: 'haichuang', company: '海创云', fullName: '海创云出海计算技术（成都）有限公司', role: '风控建模实习生', department: '风控运营部', period: '2023.11 — 2024.02', summary: '信贷风控变量与规则开发', description: '参与信贷风控特征开发及关联规则挖掘。', points: ['通过 SQL 提取业务数据，结合行为特征构建信贷风控衍生变量。', '协助搭建个人信贷风控策略自动化生成系统。', '使用 Apriori 及 Lift、Confidence 等指标，发现高风险特征组合。'], tags: ['SQL', '特征工程', 'Apriori', '信贷风控'] },
  ],
  projects: [
    { id: 'account-network', category: 'industry', type: '实习项目', context: 'vivo · 互联网安全', title: '黑灰产账号关联挖掘', summary: '结合 SynchroTrap 与 LPA，对可疑账户进行关联挖掘与扩线。', tags: ['SynchroTrap', 'LPA', '图挖掘'], visual: 'network', challenge: '黑灰产账户的行为分散在不同个体上，仅依赖单点特征，难以完整识别关联账户。', approach: '设计 SynchroTrap 与 LPA 联合框架，结合同步行为识别与标签传播，对可疑账户进行关联挖掘和扩线。', contribution: '参与黑灰产账户挖掘，负责相关算法框架设计与实现。', link: '' },
    { id: 'report-automation', category: 'industry', type: '实习项目', context: '平安银行信用卡中心 · 数据分析', title: '业务日报自动化', summary: '使用 SQL 取数与核验，通过 Python 完成数据处理和日报输出。', tags: ['Python', 'SQL', '自动化'], visual: 'pipeline', challenge: '经营指标需要持续跟踪，重复的数据整理与报表输出占用日常工作时间。', approach: '使用 SQL 支持取数及核验，以 Python 串联数据处理和日报输出流程。', contribution: '参与经营指标跟踪与分析，完成 Python 日报自动化工作。', link: '' },
    { id: 'truck-drone', category: 'research', type: '科研项目', context: '运筹优化 · 协同路径规划', title: '车机协同路径规划', summary: '在配送与覆盖任务中，研究路径、任务分配与车机协同的优化方法。', tags: ['数学建模', '智能优化', '协同调度'], visual: 'routing', challenge: '车辆与无人机的移动方式、任务能力和约束不同，需要联合考虑任务分配与路径安排。', approach: '围绕拆分配送、多区域覆盖与故障感知等场景，开展数学建模、求解算法设计和编程实验。', contribution: '参与模型搭建与代码验证、算法框架设计、编程实现及实验工作。相关论文列于下方研究记录。', link: '' },
  ],
  papers: [
    { title: 'Capacitated team orienteering with split delivery-based coordinated routing of truck-drone and drone-drone', chinese: '考虑容量约束与拆分配送的车机协同团队定向问题', venue: 'Expert Systems With Applications', status: '已发表', note: '第三作者（学生首位）；参与模型验证、算法框架设计、编程与实验。', citation: '2026 · Volume 329 · Article 132974', doi: '10.1016/j.eswa.2026.132974', link: 'https://doi.org/10.1016/j.eswa.2026.132974' },
    { title: 'Coordinated Truck-Drone Routing for Multi-Area Coverage with Flexible Coverage Node Sequencing', chinese: '面向多区域覆盖的卡车–无人机协同路径规划', venue: 'IEEE ICUS 2025', status: '已发表', note: '第一作者；参与调度模型搭建、智能优化算法设计与编程实现。', citation: '2025 · pp. 492–497', doi: '10.1109/ICUS66297.2025.11294957', link: 'https://doi.org/10.1109/ICUS66297.2025.11294957' },
    { title: 'Drone Failure Aware Truck Drone Collaborative Routing for MultiType Coverage Tasks', chinese: '考虑无人机故障的多类型覆盖任务协同路径规划', venue: '研究论文', status: '投稿中', linkNote: '暂无公开链接', note: '参与调度模型搭建、智能优化算法设计与编程实现。', link: '' },
  ],
  skills: [
    { title: '数据与编程', items: ['Python', 'SQL', '数据分析', '特征工程', 'Excel / SPSS'] },
    { title: '建模与优化', items: ['运筹建模', '智能优化', '异常检测', '关联规则', '图挖掘'] },
    { title: '交流与协作', items: ['IELTS 7.0', 'CET-6 603', '学生组织工作', '学生大使经历'] },
  ],
  honors: ['四川省优秀毕业生', '国防科技大学起点奖学金', '美国大学生数学建模竞赛 H 奖'],
  travel: {
    base: { name: '中国大陆', countryName: '中国', lon: 104.2, lat: 35.9, date: '常驻', countryCode: 'CHN' },
    visits: [
      { id: 'hong-kong', countryCode: 'HKG', name: '香港', date: '2012年8月', lon: 114.17, lat: 22.32 },
      { id: 'australia', countryCode: 'AUS', name: '澳大利亚', date: '2013年8月', lon: 134, lat: -25 },
      { id: 'japan', countryCode: 'JPN', name: '日本', date: '2014年7月', lon: 138, lat: 37 },
      { id: 'vietnam', countryCode: 'VNM', name: '越南', date: '2017年7月', lon: 106, lat: 16 },
      { id: 'usa', countryCode: 'USA', name: '美国', date: '2018年9—10月', lon: -99, lat: 38 },
      { id: 'macau', countryCode: 'MAC', name: '澳门', date: '2024年7月', lon: 113.55, lat: 22.2 },
      { id: 'singapore', countryCode: 'SGP', name: '新加坡', date: '2024年7月', lon: 103.82, lat: 1.35 },
    ],
    wishlist: [
      { id: 'uk', name: '英国', countryCode: 'GBR', lon: -2.5, lat: 54.5 },
      { id: 'france', name: '法国', countryCode: 'FRA', lon: 2.2, lat: 46.6 },
      { id: 'italy', name: '意大利', countryCode: 'ITA', lon: 12.5, lat: 42.5 },
      { id: 'austria', name: '奥地利', countryCode: 'AUT', lon: 14.1, lat: 47.6 },
      { id: 'new-zealand', name: '新西兰', countryCode: 'NZL', lon: 172.5, lat: -41.2 },
      { id: 'sweden', name: '瑞典', countryCode: 'SWE', lon: 16, lat: 62 },
      { id: 'norway', name: '挪威', countryCode: 'NOR', lon: 9, lat: 62 },
    ],
  },
  // Add { title, date, summary, url } to make the writing section appear.
  notes: [],
};
