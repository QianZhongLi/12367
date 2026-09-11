(function () {
  function compact(value) {
    return String(value || '').replace(/\s+/g, '');
  }

  const MACAO_PORT_RULES = [
    { standardPort: '横琴口岸', aliases: ['横琴口岸', '横琴'] },
    { standardPort: '拱北口岸', aliases: ['拱北口岸', '拱北', '关闸', '关闸口岸'] },
    { standardPort: '青茂口岸', aliases: ['青茂口岸', '青茂'] },
    { standardPort: '湾仔口岸', aliases: ['湾仔港', '湾仔口岸', '湾仔'] },
    { standardPort: '澳门国际机场', aliases: ['澳门国际机场', '澳门机场', '澳門國際機場', '澳門機場', 'MFM', 'MacauInternationalAirport', 'MacaoInternationalAirport'] },
    { standardPort: '外港客运码头', aliases: ['外港客运码头', '外港碼頭', '外港码头'] },
    { standardPort: '氹仔客运码头', aliases: ['氹仔客运码头', '氹仔碼頭', '氹仔码头'] },
    { standardPort: '内港客运码头', aliases: ['内港客运码头', '内港碼頭', '内港码头'] }
  ];

  const HONGKONG_PORT_RULES = [
    { standardPort: '罗湖口岸', aliases: ['罗湖口岸', '罗湖'] },
    { standardPort: '福田口岸', aliases: ['福田口岸', '福田'] },
    { standardPort: '文锦渡口岸', aliases: ['文锦渡口岸', '文锦渡'] },
    { standardPort: '莲塘口岸', aliases: ['莲塘口岸', '莲塘'] },
    { standardPort: '皇岗口岸', aliases: ['皇岗口岸', '皇岗'] },
    { standardPort: '深圳湾口岸', aliases: ['深圳湾口岸', '深圳湾'] },
    { standardPort: '沙头角口岸', aliases: ['沙头角口岸', '沙头角'] },
    { standardPort: '香港西九龙站口岸', aliases: ['西九龙', '香港西九龙', '香港西九龙站口岸', '广深港高铁西九龙'] },
    { standardPort: '香港国际机场', aliases: ['香港国际机场', '香港机场', 'HKG', 'HongKongInternationalAirport'] }
  ];

  const REVIEW_PORT_RULES = [
    { standardPort: '港珠澳大桥口岸', aliases: ['港珠澳大桥口岸', '港珠澳大桥'] },
    { standardPort: '内地机场口岸', aliases: [
      '北京首都机场', '北京首都国际机场', '首都机场', 'PEK',
      '北京大兴机场', '北京大兴国际机场', '大兴机场', 'PKX',
      '上海浦东机场', '上海浦东国际机场', '浦东机场', 'PVG',
      '上海虹桥机场', '上海虹桥国际机场', '虹桥机场', 'SHA',
      '广州白云机场', '广州白云国际机场', '广州机场', 'CAN',
      '深圳宝安机场', '深圳宝安国际机场', '深圳机场', 'SZX',
      '成都天府机场', '成都天府国际机场', '天府机场', 'TFU',
      '重庆江北机场', '重庆江北国际机场', '重庆机场', 'CKG',
      '福州长乐机场', '福州长乐国际机场', '福州机场', 'FOC',
      '杭州萧山机场', '杭州萧山国际机场', '杭州机场', 'HGH',
      '南京禄口机场', '南京禄口国际机场', '南京机场', 'NKG',
      '厦门高崎机场', '厦门高崎国际机场', '厦门机场', 'XMN',
      '武汉天河机场', '武汉天河国际机场', '武汉机场', 'WUH',
      '无锡硕放机场', '苏南硕放机场', '无锡机场', 'WUX',
      '宁波栎社机场', '宁波栎社国际机场', '宁波机场', 'NGB',
      '青岛胶东机场', '青岛胶东国际机场', '青岛机场', 'TAO',
      '泉州晋江机场', '晋江机场', 'JJN',
      '南昌昌北机场', '南昌机场', 'KHN',
      '南宁吴圩机场', '南宁机场', 'NNG',
      '合肥新桥机场', '合肥机场', 'HFE',
      '海口美兰机场', '海口机场', 'HAK',
      '贵阳龙洞堡机场', '贵阳机场', 'KWE',
      '太原武宿机场', '太原机场', 'TYN',
      '温州龙湾机场', '温州机场', 'WNZ',
      '常州奔牛机场', '常州机场', 'CZX'
    ] }
  ];

  function normalizePort(portRaw) {
    const raw = compact(portRaw);

    for (const rule of MACAO_PORT_RULES) {
      if (rule.aliases.some(alias => raw.includes(compact(alias)))) {
        return { rawPort: portRaw, standardPort: rule.standardPort, region: 'macao', needReview: false, reason: '' };
      }
    }

    for (const rule of HONGKONG_PORT_RULES) {
      if (rule.aliases.some(alias => raw.includes(compact(alias)))) {
        return { rawPort: portRaw, standardPort: rule.standardPort, region: 'hongkong', needReview: false, reason: '' };
      }
    }

    for (const rule of REVIEW_PORT_RULES) {
      if (rule.aliases.some(alias => raw.includes(compact(alias)))) {
        return { rawPort: portRaw, standardPort: rule.standardPort, region: 'review', needReview: true, reason: '该口岸可能涉及澳门或香港方向，需要人工判断' };
      }
    }

    return { rawPort: portRaw, standardPort: portRaw || '未知口岸', region: 'review', needReview: true, reason: '未能自动识别口岸归属，需要人工判断' };
  }

  window.EntryExitPorts = {
    normalizePort,
    MACAO_PORT_RULES,
    HONGKONG_PORT_RULES,
    REVIEW_PORT_RULES
  };
})();
