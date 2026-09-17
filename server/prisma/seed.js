const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

const seed = async () => {
  try {
    console.log('Starting VivaWork seed...');

    // Clean slate - delete in correct order to avoid foreign key issues
    console.log('Cleaning existing data...');
    await prisma.notification.deleteMany();
    await prisma.connection.deleteMany();
    await prisma.postLike.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.proposal.deleteMany();
    await prisma.job.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.earningBadge.deleteMany();
    await prisma.follower.deleteMany();
    await prisma.verificationRequest.deleteMany();
    await prisma.session.deleteMany();
    await prisma.loginAttempt.deleteMany();
    await prisma.savedCard.deleteMany();
    await prisma.walletTopUpOtp.deleteMany();
    await prisma.withdrawalOtp.deleteMany();
    await prisma.emailVerification.deleteMany();
    await prisma.contentViolation.deleteMany();
    await prisma.message.deleteMany();
    await prisma.offer.deleteMany();
    await prisma.review.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.delivery.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.user.deleteMany();

    console.log('Data cleaned. Creating users...');

    const adminPassword = await hashPassword('Admin@12345');
    const userPassword = await hashPassword('User@12345');

    const admin = await prisma.user.create({
      data: {
        email: 'admin@vivawork.com',
        password: adminPassword,
        firstName: 'System',
        lastName: 'Admin',
        headline: 'Platform Administrator',
        bio: 'Managing the VivaWork platform and ensuring smooth operations for all users.',
        isVerified: true,
        isAdmin: true,
        isBuyer: true,
        isFreelancer: true,
        skills: ['Management', 'Platform Operations', 'System Administration'],
        location: 'Lagos, Nigeria',
      },
    });
    console.log('Admin created:', admin.id);

    const buyer = await prisma.user.create({
      data: {
        email: 'buyer@example.com',
        password: userPassword,
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Tech Startup Founder',
        bio: 'Looking for talented developers to build amazing products. I run a fast-growing tech startup in Lagos.',
        isVerified: true,
        isBuyer: true,
        skills: ['Product Management', 'Business Strategy', 'Startup Growth'],
        location: 'Lagos, Nigeria',
        hourlyRate: 0,
      },
    });
    console.log('Buyer created:', buyer.id);

    const freelancer = await prisma.user.create({
      data: {
        email: 'freelancer@example.com',
        password: userPassword,
        firstName: 'Jane',
        lastName: 'Smith',
        headline: 'Full Stack Developer',
        bio: 'Passionate about building scalable web applications. 5+ years of experience with React, Node.js, and cloud infrastructure.',
        isVerified: true,
        isFreelancer: true,
        skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Tailwind CSS', 'AWS', 'Docker'],
        location: 'Abuja, Nigeria',
        hourlyRate: 5000,
      },
    });
    console.log('Freelancer created:', freelancer.id);

    const designer = await prisma.user.create({
      data: {
        email: 'designer@example.com',
        password: userPassword,
        firstName: 'Chinedu',
        lastName: 'Okonkwo',
        headline: 'UI/UX Designer & Brand Strategist',
        bio: 'Creating beautiful and functional designs that drive user engagement and business growth.',
        isVerified: true,
        isFreelancer: true,
        skills: ['Figma', 'Adobe XD', 'UI Design', 'UX Research', 'Branding', 'Prototyping'],
        location: 'Port Harcourt, Nigeria',
        hourlyRate: 3500,
      },
    });
    console.log('Designer created:', designer.id);

    console.log('Creating wallets...');
    await prisma.wallet.createMany({
      data: [
        { userId: admin.id, balance: 0, currency: 'NGN' },
        { userId: buyer.id, balance: 100000, currency: 'NGN' },
        { userId: freelancer.id, balance: 25000, currency: 'NGN' },
        { userId: designer.id, balance: 15000, currency: 'NGN' },
      ],
    });
    console.log('Wallets created.');

    console.log('Creating profiles...');
    await prisma.profile.createMany({
      data: [
        {
          userId: freelancer.id,
          experience: [
            { title: 'Senior Developer', company: 'TechCorp Nigeria', duration: '2022 - Present' },
            { title: 'Full Stack Developer', company: 'StartupHub', duration: '2020 - 2022' },
          ],
          education: [
            { degree: 'B.Sc Computer Science', school: 'University of Lagos', year: '2019' },
          ],
          certifications: [
            { name: 'AWS Certified Developer', issuer: 'Amazon Web Services', year: '2023' },
          ],
          portfolio: [
            { title: 'E-commerce Platform', url: 'https://example.com/project1' },
            { title: 'Fintech Dashboard', url: 'https://example.com/project2' },
          ],
          languages: ['English', 'Igbo'],
          availability: 'Full-time',
          phone: '+2348012345678',
          website: 'https://janesmith.dev',
          linkedin: 'https://linkedin.com/in/janesmith',
          github: 'https://github.com/janesmith',
        },
        {
          userId: designer.id,
          experience: [
            { title: 'Lead Designer', company: 'Creative Agency', duration: '2021 - Present' },
          ],
          education: [
            { degree: 'B.A Graphic Design', school: 'University of Nigeria', year: '2020' },
          ],
          certifications: [],
          portfolio: [
            { title: 'Banking App Redesign', url: 'https://example.com/design1' },
          ],
          languages: ['English', 'Igbo', 'Yoruba'],
          availability: 'Part-time',
          phone: '+2348098765432',
          linkedin: 'https://linkedin.com/in/chineduokonkwo',
        },
      ],
    });
    console.log('Profiles created.');

    console.log('Creating jobs...');
    const job1 = await prisma.job.create({
      data: {
        buyerId: buyer.id,
        title: 'Build a Full Stack Freelancing Platform',
        description: 'We need a talented developer to build a platform similar to Upwork with social features like LinkedIn. The platform should include user profiles, job posting, proposals, contracts, payments, and a social feed. Must be built with React, Node.js, and PostgreSQL.',
        skills: ['React', 'Node.js', 'PostgreSQL', 'Prisma', 'Paystack'],
        budget: 500000,
        budgetType: 'fixed',
        location: 'Remote',
      },
    });
    console.log('Job 1 created:', job1.id);

    const job2 = await prisma.job.create({
      data: {
        buyerId: buyer.id,
        title: 'Design a Mobile Banking App UI',
        description: 'Looking for an experienced UI/UX designer to create a modern, user-friendly mobile banking application. Need wireframes, high-fidelity mockups, and a clickable prototype.',
        skills: ['Figma', 'UI Design', 'UX Research', 'Mobile Design'],
        budget: 150000,
        budgetType: 'fixed',
        location: 'Remote',
      },
    });
    console.log('Job 2 created:', job2.id);

    console.log('Creating proposals...');
    await prisma.proposal.create({
      data: {
        jobId: job1.id,
        freelancerId: freelancer.id,
        coverLetter: 'I have extensive experience building full stack applications with React and Node.js. I have worked on similar marketplace platforms and can deliver this project with high quality. My portfolio includes a fintech dashboard and e-commerce platform that demonstrate my capabilities.',
        proposedRate: 450000,
        duration: '4 weeks',
      },
    });

    await prisma.proposal.create({
      data: {
        jobId: job2.id,
        freelancerId: designer.id,
        coverLetter: 'I specialize in fintech UI/UX design and have worked on 3 banking apps in the past. I can deliver wireframes within 3 days and full prototypes within 2 weeks.',
        proposedRate: 120000,
        duration: '2 weeks',
      },
    });
    console.log('Proposals created.');

    console.log('Creating posts...');
    await prisma.post.create({
      data: {
        userId: freelancer.id,
        content: 'Excited to announce that I am now available for new projects! Specializing in React, Node.js, and PostgreSQL. Let us build something amazing together. #freelance #webdev #hiring',
        media: [],
        likes: 12,
        comments: 3,
        shares: 1,
      },
    });

    await prisma.post.create({
      data: {
        userId: designer.id,
        content: 'Just completed a major banking app redesign project! The client loved the final result. Nothing beats the feeling of delivering work that exceeds expectations. #design #uiux #freelance',
        media: [],
        likes: 24,
        comments: 7,
        shares: 3,
      },
    });

    await prisma.post.create({
      data: {
        userId: buyer.id,
        content: 'Looking for talented developers and designers for upcoming projects. If you are passionate about building great products, send me a connection request! #hiring #startup #tech',
        media: [],
        likes: 8,
        comments: 5,
        shares: 2,
      },
    });
    console.log('Posts created.');

    console.log('Creating connections...');
    await prisma.connection.create({
      data: {
        senderId: freelancer.id,
        receiverId: buyer.id,
        status: 'accepted',
      },
    });

    await prisma.connection.create({
      data: {
        senderId: designer.id,
        receiverId: buyer.id,
        status: 'accepted',
      },
    });

    await prisma.connection.create({
      data: {
        senderId: freelancer.id,
        receiverId: designer.id,
        status: 'accepted',
      },
    });
    console.log('Connections created.');

    console.log('Creating notifications...');
    await prisma.notification.createMany({
      data: [
        {
          userId: buyer.id,
          type: 'new_proposal',
          title: 'New Proposal Received',
          message: 'Jane Smith submitted a proposal for "Build a Full Stack Freelancing Platform"',
          link: `/jobs/${job1.id}`,
          isRead: false,
        },
        {
          userId: buyer.id,
          type: 'new_proposal',
          title: 'New Proposal Received',
          message: 'Chinedu Okonkwo submitted a proposal for "Design a Mobile Banking App UI"',
          link: `/jobs/${job2.id}`,
          isRead: false,
        },
        {
          userId: freelancer.id,
          type: 'connection_accepted',
          title: 'Connection Accepted',
          message: 'John Doe accepted your connection request',
          link: `/profile/${buyer.id}`,
          isRead: true,
        },
      ],
    });
    console.log('Notifications created.');

    console.log('');
    console.log('VivaWork seed completed successfully!');
    console.log('');
    console.log('--- SEED ACCOUNTS ---');
    console.log('Admin:      admin@vivawork.com     | Password: Admin@12345');
    console.log('Buyer:      buyer@example.com      | Password: User@12345');
    console.log('Freelancer: freelancer@example.com | Password: User@12345');
    console.log('Designer:   designer@example.com    | Password: User@12345');
    console.log('');
    console.log('--- SEED DATA ---');
    console.log('Users: 4');
    console.log('Jobs: 2');
    console.log('Proposals: 2');
    console.log('Posts: 3');
    console.log('Connections: 3');
    console.log('Notifications: 3');
    console.log('');

  } catch (error) {
    console.error('Seed error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seed();