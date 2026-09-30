const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

const seed = async () => {
  try {
    console.log('🌱 Starting VivaWork seed (Non-destructive mode)...');
    console.log('⚠️  Existing data will NOT be deleted.\n');

    const adminPassword = await hashPassword('Admin@12345');
    const userPassword = await hashPassword('User@12345');

    // Helper: Create user only if email doesn't already exist
    const createIfNotExists = async (email, data) => {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        console.log(`⏭️  User ${email} already exists, skipping.`);
        return existing;
      }
      const user = await prisma.user.create({ data: { email, ...data } });
      console.log(`✅ Created user: ${email}`);
      return user;
    };

    // ─── 1. ORIGINAL 4 USERS ───
    const admin = await createIfNotExists('admin@vivawork.com', {
      password: adminPassword,
      firstName: 'System', lastName: 'Admin',
      headline: 'Platform Administrator',
      bio: 'Managing the VivaWork platform and ensuring smooth operations for all users.',
      isVerified: true, kycStatus: 'VERIFIED', isAdmin: true, isBuyer: true, isFreelancer: true,
      skills: ['Management', 'Platform Operations', 'System Administration'],
      location: 'Lagos, Nigeria',
    });

    const buyer = await createIfNotExists('buyer@example.com', {
      password: userPassword,
      firstName: 'John', lastName: 'Doe',
      headline: 'Tech Startup Founder',
      bio: 'Looking for talented developers to build amazing products. I run a fast-growing tech startup in Lagos.',
      isVerified: true, kycStatus: 'VERIFIED', isBuyer: true,
      skills: ['Product Management', 'Business Strategy', 'Startup Growth'],
      location: 'Lagos, Nigeria', hourlyRate: 0,
    });

    const freelancer = await createIfNotExists('freelancer@example.com', {
      password: userPassword,
      firstName: 'Jane', lastName: 'Smith',
      headline: 'Full Stack Developer',
      bio: 'Passionate about building scalable web applications. 5+ years of experience with React, Node.js, and cloud infrastructure.',
      isVerified: true, kycStatus: 'VERIFIED', isFreelancer: true,
      skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Tailwind CSS', 'AWS', 'Docker'],
      location: 'Abuja, Nigeria', hourlyRate: 5000,
    });

    const designer = await createIfNotExists('designer@example.com', {
      password: userPassword,
      firstName: 'Chinedu', lastName: 'Okonkwo',
      headline: 'UI/UX Designer & Brand Strategist',
      bio: 'Creating beautiful and functional designs that drive user engagement and business growth.',
      isVerified: true, kycStatus: 'VERIFIED', isFreelancer: true,
      skills: ['Figma', 'Adobe XD', 'UI Design', 'UX Research', 'Branding', 'Prototyping'],
      location: 'Port Harcourt, Nigeria', hourlyRate: 3500,
    });

    // ─── 2. 15 NEW USERS (5 Buyers, 10 Freelancers) ───
    console.log('\n👥 Creating 15 additional users...');
    const additionalUsersData = [
      // 5 Buyers (Balance >= 500k)
      { email: 'user1@example.com', firstName: 'Alice', lastName: 'Johnson', isBuyer: true, isFreelancer: false, headline: 'Product Manager', bio: 'Building the next generation of SaaS products.', skills: ['Product Management', 'Agile', 'Scrum', 'Business Strategy'], location: 'Lagos, Nigeria', walletBalance: 750000 },
      { email: 'user2@example.com', firstName: 'Bob', lastName: 'Williams', isBuyer: true, isFreelancer: false, headline: 'Marketing Director', bio: 'Scaling brands through data-driven marketing strategies.', skills: ['Digital Marketing', 'SEO', 'Content Strategy', 'Growth Hacking'], location: 'Abuja, Nigeria', walletBalance: 600000 },
      { email: 'user3@example.com', firstName: 'Charlie', lastName: 'Brown', isBuyer: true, isFreelancer: false, headline: 'E-commerce Founder', bio: 'Running a fast-growing online retail business.', skills: ['E-commerce', 'Supply Chain', 'Retail', 'Shopify'], location: 'Port Harcourt, Nigeria', walletBalance: 850000 },
      { email: 'user4@example.com', firstName: 'Diana', lastName: 'Prince', isBuyer: true, isFreelancer: false, headline: 'Fintech CEO', bio: 'Disrupting the financial services industry in Africa.', skills: ['Finance', 'Fintech', 'Accounting', 'Business Development'], location: 'Lagos, Nigeria', walletBalance: 1200000 },
      { email: 'user5@example.com', firstName: 'Evan', lastName: 'Peters', isBuyer: true, isFreelancer: false, headline: 'HealthTech Innovator', bio: 'Developing software solutions for modern healthcare.', skills: ['Healthcare', 'HealthTech', 'Project Management', 'Compliance'], location: 'Ibadan, Nigeria', walletBalance: 550000 },
      
      // 10 Freelancers (Various diverse skills)
      { email: 'user6@example.com', firstName: 'Fiona', lastName: 'Gallagher', isBuyer: false, isFreelancer: true, headline: 'Full Stack Developer', bio: 'Expert in building scalable web applications.', skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Tailwind CSS'], location: 'Lagos, Nigeria', hourlyRate: 8000, walletBalance: 50000 },
      { email: 'user7@example.com', firstName: 'George', lastName: 'Martin', isBuyer: false, isFreelancer: true, headline: 'Python & AI Engineer', bio: 'Building intelligent systems and data pipelines.', skills: ['Python', 'Django', 'Machine Learning', 'Data Science', 'TensorFlow'], location: 'Abuja, Nigeria', hourlyRate: 10000, walletBalance: 75000 },
      { email: 'user8@example.com', firstName: 'Hannah', lastName: 'Abbott', isBuyer: false, isFreelancer: true, headline: 'Mobile App Developer', bio: 'Creating seamless cross-platform mobile experiences.', skills: ['Flutter', 'Dart', 'React Native', 'Firebase', 'iOS'], location: 'Enugu, Nigeria', hourlyRate: 7000, walletBalance: 40000 },
      { email: 'user9@example.com', firstName: 'Ian', lastName: 'Malcolm', isBuyer: false, isFreelancer: true, headline: 'Senior UI/UX Designer', bio: 'Crafting intuitive and beautiful user interfaces.', skills: ['UI/UX Design', 'Figma', 'Adobe XD', 'Prototyping', 'User Research'], location: 'Lagos, Nigeria', hourlyRate: 6000, walletBalance: 60000 },
      { email: 'user10@example.com', firstName: 'Julia', lastName: 'Roberts', isBuyer: false, isFreelancer: true, headline: 'Brand & Graphic Designer', bio: 'Visual storyteller helping brands stand out.', skills: ['Graphic Design', 'Adobe Illustrator', 'Photoshop', 'Branding', 'Typography'], location: 'Kano, Nigeria', hourlyRate: 5000, walletBalance: 30000 },
      { email: 'user11@example.com', firstName: 'Kevin', lastName: 'Hart', isBuyer: false, isFreelancer: true, headline: 'SEO Content Writer', bio: 'Writing compelling copy that ranks and converts.', skills: ['Content Writing', 'Copywriting', 'SEO', 'Blogging', 'Technical Writing'], location: 'Lagos, Nigeria', hourlyRate: 4000, walletBalance: 25000 },
      { email: 'user12@example.com', firstName: 'Laura', lastName: 'Croft', isBuyer: false, isFreelancer: true, headline: 'Video Editor & Motion Designer', bio: 'Bringing stories to life through dynamic video editing.', skills: ['Video Editing', 'Premiere Pro', 'After Effects', 'Motion Graphics', 'DaVinci Resolve'], location: 'Abuja, Nigeria', hourlyRate: 6500, walletBalance: 45000 },
      { email: 'user13@example.com', firstName: 'Mike', lastName: 'Ross', isBuyer: false, isFreelancer: true, headline: 'DevOps Engineer', bio: 'Automating infrastructure and ensuring high availability.', skills: ['DevOps', 'AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform'], location: 'Lagos, Nigeria', hourlyRate: 12000, walletBalance: 90000 },
      { email: 'user14@example.com', firstName: 'Nancy', lastName: 'Wheeler', isBuyer: false, isFreelancer: true, headline: 'Web3 & Blockchain Developer', bio: 'Building decentralized applications and smart contracts.', skills: ['Blockchain', 'Solidity', 'Web3.js', 'Ethereum', 'Smart Contracts'], location: 'Remote', hourlyRate: 15000, walletBalance: 120000 },
      { email: 'user15@example.com', firstName: 'Oscar', lastName: 'Martinez', isBuyer: false, isFreelancer: true, headline: 'Cybersecurity Specialist', bio: 'Protecting digital assets and securing networks.', skills: ['Cybersecurity', 'Penetration Testing', 'Network Security', 'Ethical Hacking', 'Compliance'], location: 'Lagos, Nigeria', hourlyRate: 11000, walletBalance: 80000 }
    ];

    const createdUsers = [];
    for (const u of additionalUsersData) {
      const user = await createIfNotExists(u.email, {
        password: userPassword,
        firstName: u.firstName, lastName: u.lastName,
        headline: u.headline, bio: u.bio,
        isVerified: true, kycStatus: 'VERIFIED',
        isBuyer: u.isBuyer, isFreelancer: u.isFreelancer,
        skills: u.skills, location: u.location,
        hourlyRate: u.hourlyRate || 0,
      });
      createdUsers.push({ ...user, walletBalance: u.walletBalance, originalData: u });
    }

    // ─── 3. WALLETS (Only create if missing) ───
    console.log('\n💰 Ensuring wallets exist...');
    const walletMap = {
      [admin.id]: 0,
      [buyer.id]: 500000,
      [freelancer.id]: 25000,
      [designer.id]: 15000,
    };
    createdUsers.forEach(u => { walletMap[u.id] = u.walletBalance; });

    for (const [userId, balance] of Object.entries(walletMap)) {
      const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!existingWallet) {
        await prisma.wallet.create({ data: { userId, balance, currency: 'NGN' } });
        console.log(`✅ Created wallet for user ${userId} with balance ${balance}`);
      } else {
        console.log(`⏭️  Wallet for user ${userId} already exists, skipping.`);
      }
    }

    // ─── 4. PROFILES (Only for original freelancers if missing) ───
    console.log('\n📄 Ensuring profiles exist...');
    const profileData = [
      {
        userId: freelancer.id,
        experience: [{ title: 'Senior Developer', company: 'TechCorp Nigeria', duration: '2022 - Present' }],
        education: [{ degree: 'B.Sc Computer Science', school: 'University of Lagos', year: '2019' }],
        certifications: [{ name: 'AWS Certified Developer', issuer: 'Amazon Web Services', year: '2023' }],
        portfolio: [{ title: 'E-commerce Platform', url: 'https://example.com/project1' }],
        languages: ['English', 'Igbo'], availability: 'Full-time',
      },
      {
        userId: designer.id,
        experience: [{ title: 'Lead Designer', company: 'Creative Agency', duration: '2021 - Present' }],
        education: [{ degree: 'B.A Graphic Design', school: 'University of Nigeria', year: '2020' }],
        portfolio: [{ title: 'Banking App Redesign', url: 'https://example.com/design1' }],
        languages: ['English', 'Igbo', 'Yoruba'], availability: 'Part-time',
      }
    ];

    for (const p of profileData) {
      const existingProfile = await prisma.profile.findUnique({ where: { userId: p.userId } });
      if (!existingProfile) {
        await prisma.profile.create({ data: p });
        console.log(`✅ Created profile for user ${p.userId}`);
      } else {
        console.log(`⏭️  Profile for user ${p.userId} already exists, skipping.`);
      }
    }

    // ─── 5. JOBS (Only if buyer has no jobs yet) ───
    console.log('\n💼 Ensuring jobs exist...');
    const existingBuyerJobs = await prisma.job.count({ where: { buyerId: buyer.id } });
    if (existingBuyerJobs === 0) {
      await prisma.job.create({
        data: {
          buyerId: buyer.id,
          title: 'Build a Full Stack Freelancing Platform',
          description: 'We need a talented developer to build a platform similar to Upwork with social features like LinkedIn.',
          skills: ['React', 'Node.js', 'PostgreSQL', 'Prisma', 'Paystack'],
          budget: 500000, budgetType: 'fixed', location: 'Remote',
        },
      });
      await prisma.job.create({
        data: {
          buyerId: buyer.id,
          title: 'Design a Mobile Banking App UI',
          description: 'Looking for an experienced UI/UX designer to create a modern, user-friendly mobile banking application.',
          skills: ['Figma', 'UI Design', 'UX Research', 'Mobile Design'],
          budget: 150000, budgetType: 'fixed', location: 'Remote',
        },
      });
      console.log('✅ Created 2 jobs for buyer.');
    } else {
      console.log(`⏭️  Buyer already has ${existingBuyerJobs} jobs, skipping.`);
    }

    // ─── 6. POSTS (2 posts per new user, only if they have none) ───
    console.log('\n📝 Ensuring posts exist for new users...');
    for (const u of createdUsers) {
      const existingPostCount = await prisma.post.count({ where: { userId: u.id } });
      if (existingPostCount === 0) {
        const skill1 = u.originalData.skills[0];
        const skill2 = u.originalData.skills[1] || skill1;
        const role = u.originalData.isBuyer ? 'hiring' : 'freelance';

        await prisma.post.createMany({
          data: [
            {
              userId: u.id,
              content: `Excited to share my expertise in ${skill1} and ${skill2}. Always looking for new challenges and opportunities to grow! #${skill1.replace(/\s+/g, '')} #${skill2.replace(/\s+/g, '')} #VivaWork #${role}`,
              media: [], likes: Math.floor(Math.random() * 20), comments: Math.floor(Math.random() * 5), shares: Math.floor(Math.random() * 3),
            },
            {
              userId: u.id,
              content: `Just wrapped up an amazing project involving ${skill1}. The results were beyond expectations. Open to new collaborations! #${role} #${skill1.replace(/\s+/g, '')} #success`,
              media: [], likes: Math.floor(Math.random() * 30), comments: Math.floor(Math.random() * 8), shares: Math.floor(Math.random() * 5),
            }
          ]
        });
        console.log(`✅ Created 2 posts for ${u.email}`);
      } else {
        console.log(`⏭️  ${u.email} already has posts, skipping.`);
      }
    }

    console.log('\n🎉 VivaWork seed completed successfully!');
    console.log('🔐 All passwords: User@12345 (Admin: Admin@12345)');
    console.log('📧 New users: user1@example.com to user15@example.com\n');

  } catch (error) {
    console.error('❌ Seed error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seed();