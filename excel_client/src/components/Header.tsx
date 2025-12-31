import { Flex, Heading, Avatar, Text, Box } from '@radix-ui/themes';
import { useNavigate } from 'react-router-dom';
import reactLogo from '../assets/react.svg';

export const Header = () => {
    const navigate = useNavigate();

    return (
        <Flex justify="between" align="center" px="5" py="3" style={{ borderBottom: '1px solid var(--gray-5)' }}>
            <Flex align="center" gap="3" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                <img src={reactLogo} alt="Exgent Logo" style={{ height: 24 }} />
                <Heading size="5">Exgent</Heading>
            </Flex>
            <Flex align="center" gap="3">
                <Box>
                    <Text size="2" weight="bold">User One</Text>
                </Box>
                <Avatar
                    fallback="U1"
                    radius="full"
                    size="2"
                    color="indigo"
                />
            </Flex>
        </Flex>
    );
};

