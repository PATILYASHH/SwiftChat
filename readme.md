Hello

```

#include <iostream>
using namespace std;

#define MAX 5

class queue
{
    int arr[MAX];
    int front, rear;

public:
    queue()
    {
        front = -1;
        rear = -1;
    }

    int isFULL()
    {
        if (rear == MAX - 1)
        {
            return 1;
        }
        else
        {
            return 0;
        }
    }

    int isEMPTY()
    {
        if (front == -1 || front > rear)
        {
            return 1;
        }
        else
        {
            return 0;
        }
    }

    void insert(int item)
    {
        if (front == -1)
        {
            front = 0;
        }
        rear = rear + 1;
        arr[rear] = item;
        cout << "\nInserted into queue: " << item;
    }

    void del()
    {
        int temp;
        temp = arr[front];
        front = front + 1;
        cout << "\nElement " << temp << " is deleted.";
    }

    void display()
    {
        int i;
        for (i = front; i <= rear; i++)
        {
            cout << "\n" << arr[i];
        }
    }
};

int main()
{
    int ch, item;
    queue q;

    while (1)
    {
        cout << "\nQueue menu:\n";
        cout << "1. Insert\n";
        cout << "2. Delete\n";
        cout << "3. Display\n";
        cout << "4. Exit\n";
        cout << "Enter your choice: ";
        cin >> ch;

        switch (ch)
        {
        case 1:
            if (q.isFULL())
            {
                cout << "\nQueue is full.";
            }
            else
            {
                cout << "\nEnter the number to insert: ";
                cin >> item;
                q.insert(item);
            }
            break;

        case 2:
            if (q.isEMPTY())
            {
                cout << "\nQueue is empty.";
            }
            else
            {
                q.del();
            }
            break;

        case 3:
            if (q.isEMPTY())
            {
                cout << "\nQueue is empty.";
            }
            else
            {
                q.display();
            }
            break;

        case 4:
            return 0;

        default:
            cout << "\nWrong choice, try again.";
        }
    }
}

```