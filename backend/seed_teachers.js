require('dotenv').config({path: '../.env'});
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const rawData = `Dr. Md. Kamal Hosain,Professor,kamaleteruet@gmail.com,880-1716130151
Dr. Mst. Fateha Samad,Professor,fatehasamad@ete.ruet.ac.bd,880-1796382971
Md. Aslam Mollah,Assistant Professor,ruet10aslam@gmail.com,880-1738643809
Dr. Md. Yeakub Ali,Assistant Professor,yeakub.ruet08@gmail.com,880-1722923669
Md. Rakib Hossain,Assistant Professor,rakib.hossain@ete.ruet.ac.bd,880-1710000000
Hasan Sarker,Assistant Professor,hasan.ruet.ete@gmail.com,880-1612707075
Farzana Akter,Assistant Professor,farzanaeteruet@gmail.com,880-1791282222
Md Abu Ismail Siddique,Assistant Professor,saif101303@gmail.com,880-1521300294
Sharaf Tasnim,Assistant Professor,sharaftasnim786@gmail.com, 880-1789223600
Md. Mahmudul Hasan,Lecturer,mahmudul@ete.ruet.ac.bd, 880-1710132822
Md. Rakibul Islam,Lecturer,rakibulislam@ete.ruet.ac.bd,880-1304172487
Mohammed Nazmul Islam Nahin,Lecturer,nahinete.ruet@gmail.com,880-1876519534
Rubaeat Ahammed,Lecturer,rubaeat.ahammed@ete.ruet.ac.bd,880-1782359987
Rifa Tabassum Mim,Lecturer,rifa.mim@ete.ruet.ac.bd,880-177777777 
TEST TEACHER A,TEST,naim.ete.ruet@gmail.com,880-1576668319
TEST TEACHER B,TEST,mohammadnaim969@gmail.com,880-1576668319`;

const teachers = rawData.split('\n').filter(line => line.trim() !== '').map((line, index) => {
  const [name, designation, email, mobile] = line.split(',');
  return {
    id: 'teacher_' + (index + 1),
    name: name.trim(),
    designation: designation.trim(),
    email: email.trim(),
    mobile: mobile.trim(),
    password: 'teacher123',
    role: 'teacher',
    department: 'ETE'
  };
});

async function seedTeachers() {
  // Wipe out previous teachers
  await supabase.from('users').delete().eq('role', 'teacher');
  
  const { error } = await supabase.from('users').insert(teachers);
  if (error) console.error('Teacher Insert Error:', error);
  else console.log('Successfully inserted ' + teachers.length + ' teachers with sequential IDs.');
}
seedTeachers();
